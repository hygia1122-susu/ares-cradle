import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useOutpostStore } from '@/modules/store/useOutpostStore';

const LOOK_SENSITIVITY = 0.0022;
const LOOK_SMOOTHING = 20;
const MAX_PITCH = 1.45;
const MAX_ROVER_LOOK_OFFSET = 1.2;

export const wrapCameraYaw = (yaw: number) =>
  ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

export const clampCameraPitch = (pitch: number) =>
  THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);

export const updateCameraLook = (yaw: number, pitch: number, movementX: number, movementY: number) => ({
  yaw: wrapCameraYaw(yaw - movementX * LOOK_SENSITIVITY),
  pitch: clampCameraPitch(pitch - movementY * LOOK_SENSITIVITY),
});

const dampAngle = (current: number, target: number, amount: number) =>
  wrapCameraYaw(current + wrapCameraYaw(target - current) * amount);

const modalIsOpen = () =>
  typeof document !== 'undefined' && !!document.querySelector('[role="dialog"]');

/** First-person camera with native pointer lock and an independent rover look offset. */
export const CameraRig: React.FC = () => {
  const { camera, gl } = useThree();
  const setCameraLook = useOutpostStore((state) => state.setCameraLook);
  const cameraYaw = useOutpostStore((state) => state.cameraYaw);
  const cameraPitch = useOutpostStore((state) => state.cameraPitch);
  const setPointerLocked = useOutpostStore((state) => state.setPointerLocked);
  const toggleSkyView = useOutpostStore((state) => state.toggleSkyView);

  const targetYaw = useRef(cameraYaw);
  const targetPitch = useRef(cameraPitch);
  const actualYaw = useRef(cameraYaw);
  const actualPitch = useRef(cameraPitch);
  const humanLook = useRef({ yaw: cameraYaw, pitch: cameraPitch });
  const roverLookOffset = useRef(0);
  const remotePitch = useRef(0);
  const touchDrag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const wasRemote = useRef(useOutpostStore.getState().isDrivingRover);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.code === 'Escape') {
        if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
        setPointerLocked(false);
        return;
      }
      if (event.code === 'KeyV' && !modalIsOpen()) toggleSkyView();
    };

    const originalCanvasTitle = gl.domElement.title;
    const handlePointerLockFailure = () => {
      setPointerLocked(false);
      gl.domElement.title = 'Mouse capture unavailable. Click the world again to retry.';
    };
    const releasePointerLock = () => {
      touchDrag.current = null;
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      setPointerLocked(false);
    };
    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      setPointerLocked(locked);
      if (locked) gl.domElement.title = originalCanvasTitle;
    };
    const handlePointerLockError = () => handlePointerLockFailure();
    const handleBlur = () => releasePointerLock();
    const handleVisibilityChange = () => {
      if (document.hidden) releasePointerLock();
    };
    const handleCanvasClick = (event: MouseEvent) => {
      if (!event.isTrusted || event.target !== gl.domElement || modalIsOpen()) return;
      if ('pointerType' in event && event.pointerType === 'touch') return;
      if (document.pointerLockElement === gl.domElement) return;
      try {
        const request = gl.domElement.requestPointerLock();
        if (request && typeof request.then === 'function') void request.catch(handlePointerLockFailure);
      } catch {
        handlePointerLockFailure();
      }
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement || modalIsOpen()) return;
      const store = useOutpostStore.getState();
      if (store.isDrivingRover) {
        roverLookOffset.current = THREE.MathUtils.clamp(
          roverLookOffset.current - event.movementX * LOOK_SENSITIVITY,
          -MAX_ROVER_LOOK_OFFSET,
          MAX_ROVER_LOOK_OFFSET
        );
        remotePitch.current = clampCameraPitch(remotePitch.current - event.movementY * LOOK_SENSITIVITY);
      } else {
        const nextLook = updateCameraLook(targetYaw.current, targetPitch.current, event.movementX, event.movementY);
        targetYaw.current = nextLook.yaw;
        targetPitch.current = nextLook.pitch;
      }
    };
    const handleTouchPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || modalIsOpen()) return;
      event.preventDefault();
      gl.domElement.setPointerCapture?.(event.pointerId);
      touchDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const handleTouchPointerMove = (event: PointerEvent) => {
      const drag = touchDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (modalIsOpen() || document.hidden) {
        touchDrag.current = null;
        return;
      }
      const movementX = event.clientX - drag.x;
      const movementY = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (useOutpostStore.getState().isDrivingRover) {
        roverLookOffset.current = THREE.MathUtils.clamp(
          roverLookOffset.current - movementX * LOOK_SENSITIVITY,
          -MAX_ROVER_LOOK_OFFSET,
          MAX_ROVER_LOOK_OFFSET
        );
        remotePitch.current = clampCameraPitch(remotePitch.current - movementY * LOOK_SENSITIVITY);
      } else {
        const nextLook = updateCameraLook(targetYaw.current, targetPitch.current, movementX, movementY);
        targetYaw.current = nextLook.yaw;
        targetPitch.current = nextLook.pitch;
      }
    };
    const handleTouchPointerEnd = (event: PointerEvent) => {
      if (touchDrag.current?.pointerId === event.pointerId) touchDrag.current = null;
    };

    gl.domElement.addEventListener('click', handleCanvasClick);
    gl.domElement.addEventListener('pointerdown', handleTouchPointerDown);
    gl.domElement.addEventListener('pointermove', handleTouchPointerMove);
    gl.domElement.addEventListener('pointerup', handleTouchPointerEnd);
    gl.domElement.addEventListener('pointercancel', handleTouchPointerEnd);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    handlePointerLockChange();
    return () => {
      gl.domElement.removeEventListener('click', handleCanvasClick);
      gl.domElement.removeEventListener('pointerdown', handleTouchPointerDown);
      gl.domElement.removeEventListener('pointermove', handleTouchPointerMove);
      gl.domElement.removeEventListener('pointerup', handleTouchPointerEnd);
      gl.domElement.removeEventListener('pointercancel', handleTouchPointerEnd);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      gl.domElement.title = originalCanvasTitle;
      releasePointerLock();
    };
  }, [gl.domElement, setPointerLocked, toggleSkyView]);

  useFrame((_, delta) => {
    const store = useOutpostStore.getState();
    const remote = store.isDrivingRover;
    const lockedToCanvas = document.pointerLockElement === gl.domElement;
    if (modalIsOpen() || document.hidden || remote !== wasRemote.current) {
      touchDrag.current = null;
      if (lockedToCanvas) document.exitPointerLock();
      if (store.isPointerLocked) setPointerLocked(false);
    }

    if (remote !== wasRemote.current) {
      if (remote) {
        humanLook.current = { yaw: targetYaw.current, pitch: targetPitch.current };
        roverLookOffset.current = 0;
        remotePitch.current = 0;
        actualYaw.current = wrapCameraYaw(store.roverHeading + Math.PI);
        actualPitch.current = 0;
      } else {
        targetYaw.current = humanLook.current.yaw;
        targetPitch.current = humanLook.current.pitch;
      }
      wasRemote.current = remote;
    }

    const baseYaw = remote ? store.roverHeading + Math.PI + roverLookOffset.current : targetYaw.current;
    const desiredYaw = wrapCameraYaw(baseYaw);
    const desiredPitch = remote ? remotePitch.current : targetPitch.current;
    const safeDelta = Math.min(Math.max(delta, 0), 0.05);
    const smoothing = 1 - Math.exp(-LOOK_SMOOTHING * safeDelta);
    actualYaw.current = dampAngle(actualYaw.current, desiredYaw, smoothing);
    actualPitch.current = THREE.MathUtils.lerp(actualPitch.current, desiredPitch, smoothing);
    actualPitch.current = clampCameraPitch(actualPitch.current);

    const position = remote ? store.roverPos : store.playerPos;
    const roverCos = Math.cos(store.roverHeading);
    const roverSin = Math.sin(store.roverHeading);
    camera.position.set(
      position[0] + (remote ? -0.273 * roverCos + 0.55 * roverSin : 0),
      position[1] + (remote ? 1.48 : 1.45),
      position[2] + (remote ? 0.273 * roverSin + 0.55 * roverCos : 0)
    );
    camera.rotation.order = 'YXZ';
    camera.rotation.set(actualPitch.current, actualYaw.current, 0, 'YXZ');
    setCameraLook(actualYaw.current, actualPitch.current);

    if (!remote) {
      humanLook.current = { yaw: targetYaw.current, pitch: targetPitch.current };
    }
  });

  return null;
};

export default CameraRig;
