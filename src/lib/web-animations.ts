/* eslint-disable */
// @ts-nocheck — TouchEvent types need proper DOM lib configuration
interface AnimOptions {
  duration?: number;
  delay?: number;
  easing?: string;
  fill?: FillMode;
  iterations?: number;
  direction?: PlaybackDirection;
}

interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

interface GestureConfig {
  gesture: 'swipe' | 'pinch' | 'tap';
  animation: string;
}

interface SpringState {
  position: number;
  velocity: number;
  target: number;
}

function applyHardwareAcceleration(element: Element): void {
  const htmlElement = element as HTMLElement;
  htmlElement.style.willChange = 'transform, opacity';
  htmlElement.style.transform = 'translateZ(0)';
}

function removeHardwareAcceleration(element: Element): void {
  const htmlElement = element as HTMLElement;
  htmlElement.style.willChange = 'auto';
}

function getDefaultOptions(options: AnimOptions = {}): AnimOptions {
  return {
    duration: options.duration ?? 300,
    delay: options.delay ?? 0,
    easing: options.easing ?? 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: options.fill ?? 'forwards',
    iterations: options.iterations ?? 1,
    direction: options.direction ?? 'normal'
  };
}

export function animateIn(element: Element, options: AnimOptions = {}): Animation {
  applyHardwareAcceleration(element);
  
  const defaultOptions = getDefaultOptions(options);
  
  const keyframes: Keyframe[] = [
    { 
      transform: 'scale(0.8) translateZ(0)', 
      opacity: '0',
      offset: 0 
    },
    { 
      transform: 'scale(1) translateZ(0)', 
      opacity: '1',
      offset: 1 
    }
  ];

  const animation = element.animate(keyframes, {
    duration: defaultOptions.duration!,
    delay: defaultOptions.delay!,
    easing: defaultOptions.easing!,
    fill: defaultOptions.fill!,
    iterations: defaultOptions.iterations!,
    direction: defaultOptions.direction!
  });

  animation.onfinish = () => {
    removeHardwareAcceleration(element);
  };

  return animation;
}

export function animateOut(element: Element, options: AnimOptions = {}): Animation {
  applyHardwareAcceleration(element);
  
  const defaultOptions = getDefaultOptions(options);
  
  const keyframes: Keyframe[] = [
    { 
      transform: 'scale(1) translateZ(0)', 
      opacity: '1',
      offset: 0 
    },
    { 
      transform: 'scale(0.8) translateZ(0)', 
      opacity: '0',
      offset: 1 
    }
  ];

  const animation = element.animate(keyframes, {
    duration: defaultOptions.duration!,
    delay: defaultOptions.delay!,
    easing: defaultOptions.easing!,
    fill: defaultOptions.fill!,
    iterations: defaultOptions.iterations!,
    direction: defaultOptions.direction!
  });

  animation.onfinish = () => {
    removeHardwareAcceleration(element);
  };

  return animation;
}

export function animateSlide(
  element: Element, 
  direction: 'left' | 'right' | 'up' | 'down', 
  options: AnimOptions = {}
): Animation {
  applyHardwareAcceleration(element);
  
  const defaultOptions = getDefaultOptions(options);
  
  const transforms: Record<'left' | 'right' | 'up' | 'down', { from: string; to: string }> = {
    left: { from: 'translateX(-100%) translateZ(0)', to: 'translateX(0) translateZ(0)' },
    right: { from: 'translateX(100%) translateZ(0)', to: 'translateX(0) translateZ(0)' },
    up: { from: 'translateY(-100%) translateZ(0)', to: 'translateY(0) translateZ(0)' },
    down: { from: 'translateY(100%) translateZ(0)', to: 'translateY(0) translateZ(0)' }
  };

  const keyframes: Keyframe[] = [
    { 
      transform: transforms[direction].from, 
      opacity: '0',
      offset: 0 
    },
    { 
      transform: transforms[direction].to, 
      opacity: '1',
      offset: 1 
    }
  ];

  const animation = element.animate(keyframes, {
    duration: defaultOptions.duration!,
    delay: defaultOptions.delay!,
    easing: defaultOptions.easing!,
    fill: defaultOptions.fill!,
    iterations: defaultOptions.iterations!,
    direction: defaultOptions.direction!
  });

  animation.onfinish = () => {
    removeHardwareAcceleration(element);
  };

  return animation;
}

export function animatePulse(element: Element, options: AnimOptions = {}): Animation {
  applyHardwareAcceleration(element);
  
  const defaultOptions = getDefaultOptions(options);
  defaultOptions.iterations = options.iterations ?? Infinity;
  
  const keyframes: Keyframe[] = [
    { 
      transform: 'scale(1) translateZ(0)', 
      boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)',
      offset: 0 
    },
    { 
      transform: 'scale(1.02) translateZ(0)', 
      boxShadow: '0 0 20px 10px rgba(100, 150, 255, 0.3)',
      offset: 0.5 
    },
    { 
      transform: 'scale(1) translateZ(0)', 
      boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)',
      offset: 1 
    }
  ];

  const animation = element.animate(keyframes, {
    duration: defaultOptions.duration!,
    delay: defaultOptions.delay!,
    easing: defaultOptions.easing!,
    fill: defaultOptions.fill!,
    iterations: defaultOptions.iterations!,
    direction: defaultOptions.direction!
  });

  return animation;
}

export function animateShake(element: Element, options: AnimOptions = {}): Animation {
  applyHardwareAcceleration(element);
  
  const defaultOptions = getDefaultOptions(options);
  
  const keyframes: Keyframe[] = [
    { transform: 'translateX(0) translateZ(0)', offset: 0 },
    { transform: 'translateX(-10px) translateZ(0)', offset: 0.1 },
    { transform: 'translateX(10px) translateZ(0)', offset: 0.2 },
    { transform: 'translateX(-10px) translateZ(0)', offset: 0.3 },
    { transform: 'translateX(10px) translateZ(0)', offset: 0.4 },
    { transform: 'translateX(-10px) translateZ(0)', offset: 0.5 },
    { transform: 'translateX(10px) translateZ(0)', offset: 0.6 },
    { transform: 'translateX(-10px) translateZ(0)', offset: 0.7 },
    { transform: 'translateX(10px) translateZ(0)', offset: 0.8 },
    { transform: 'translateX(-10px) translateZ(0)', offset: 0.9 },
    { transform: 'translateX(0) translateZ(0)', offset: 1 }
  ];

  const animation = element.animate(keyframes, {
    duration: defaultOptions.duration!,
    delay: defaultOptions.delay!,
    easing: defaultOptions.easing!,
    fill: defaultOptions.fill!,
    iterations: defaultOptions.iterations!,
    direction: defaultOptions.direction!
  });

  animation.onfinish = () => {
    removeHardwareAcceleration(element);
  };

  return animation;
}

export function animateCountUp(
  element: Element, 
  from: number, 
  to: number, 
  duration: number = 1000
): Animation {
  const startTime = performance.now();
  const difference = to - from;
  
  const keyframes: Keyframe[] = [
    { 
      transform: `translateY(0) translateZ(0)`,
      offset: 0 
    },
    { 
      transform: `translateY(0) translateZ(0)`,
      offset: 1 
    }
  ];

  const animation = element.animate(keyframes, {
    duration: duration,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: 'forwards'
  });

  let currentValue = from;
  
  const updateValue = (): void => {
    if (currentValue !== to) {
      const progress = (performance.now() - startTime) / duration;
      const easedProgress = Math.min(Math.max(progress, 0), 1);
      const easedValue = easedProgress * (2 - easedProgress);
      
      currentValue = Math.round(from + difference * easedValue);
      element.textContent = String(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(updateValue);
      }
    }
  };

  requestAnimationFrame(updateValue);

  return animation;
}

export function animateStagger(
  elements: Element[], 
  animation: string, 
  options: AnimOptions = {}
): Animation[] {
  const defaultOptions = getDefaultOptions(options);
  const animations: Animation[] = [];

  elements.forEach((element, index) => {
    const staggerDelay = (options.delay ?? 0) + index * 50;
    
    let anim: Animation;
    
    switch (animation) {
      case 'fadeIn':
        anim = animateIn(element, {
          ...defaultOptions,
          delay: staggerDelay
        });
        break;
      case 'fadeOut':
        anim = animateOut(element, {
          ...defaultOptions,
          delay: staggerDelay
        });
        break;
      case 'slideLeft':
        anim = animateSlide(element, 'left', {
          ...defaultOptions,
          delay: staggerDelay
        });
        break;
      case 'slideRight':
        anim = animateSlide(element, 'right', {
          ...defaultOptions,
          delay: staggerDelay
        });
        break;
      case 'slideUp':
        anim = animateSlide(element, 'up', {
          ...defaultOptions,
          delay: staggerDelay
        });
        break;
      case 'slideDown':
        anim = animateSlide(element, 'down', {
          ...defaultOptions,
          delay: staggerDelay
        });
        break;
      case 'pulse':
        anim = animatePulse(element, {
          ...defaultOptions,
          delay: staggerDelay
        });
        break;
      case 'shake':
        anim = animateShake(element, {
          ...defaultOptions,
          delay: staggerDelay
        });
        break;
      default:
        anim = animateIn(element, {
          ...defaultOptions,
          delay: staggerDelay
        });
    }
    
    animations.push(anim);
  });

  return animations;
}

export function animateTimeline(
  elements: Element[], 
  timeline: { progress: number }
): void {
  const totalElements = elements.length;
  const visibleCount = Math.ceil(totalElements * timeline.progress);
  
  elements.forEach((element, index) => {
    const isVisible = index < visibleCount;
    const htmlElement = element as HTMLElement;
    
    if (isVisible) {
      const elementProgress = Math.min(
        (timeline.progress * totalElements - index) / 1, 
        1
      );
      
      const scale = 0.8 + elementProgress * 0.2;
      const opacity = elementProgress;
      
      htmlElement.style.transform = `scale(${scale}) translateZ(0)`;
      htmlElement.style.opacity = String(opacity);
    } else {
      htmlElement.style.transform = 'scale(0.8) translateZ(0)';
      htmlElement.style.opacity = '0';
    }
  });
}

export function createSpringAnimation(
  element: Element, 
  config: SpringConfig = {}
): { start: (target: number) => void; stop: () => void; isRunning: () => boolean } {
  const stiffness = config.stiffness ?? 170;
  const damping = config.damping ?? 26;
  const mass = config.mass ?? 1;
  
  const state: SpringState = {
    position: 0,
    velocity: 0,
    target: 0
  };
  
  let animationFrameId: number | null = null;
  let isAnimating = false;
  
  applyHardwareAcceleration(element);
  
  const step = (): void => {
    const springForce = -stiffness * (state.position - state.target);
    const dampingForce = -damping * state.velocity;
    const acceleration = (springForce + dampingForce) / mass;
    
    state.velocity += acceleration * (1 / 60);
    state.position += state.velocity * (1 / 60);
    
    const htmlElement = element as HTMLElement;
    htmlElement.style.transform = `translateX(${state.position}px) translateZ(0)`;
    
    if (Math.abs(state.velocity) < 0.01 && Math.abs(state.position - state.target) < 0.01) {
      state.position = state.target;
      state.velocity = 0;
      htmlElement.style.transform = `translateX(${state.position}px) translateZ(0)`;
      isAnimating = false;
      removeHardwareAcceleration(element);
      return;
    }
    
    animationFrameId = requestAnimationFrame(step);
  };
  
  return {
    start(target: number): void {
      state.target = target;
      if (!isAnimating) {
        isAnimating = true;
        animationFrameId = requestAnimationFrame(step);
      }
    },
    stop(): void {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      isAnimating = false;
      removeHardwareAcceleration(element);
    },
    isRunning(): boolean {
      return isAnimating;
    }
  };
}

export function createGestureAnimation(
  element: Element, 
  gestures: GestureConfig[]
): { enable: () => void; disable: () => void } {
  const gestureHandlers: Map<string, (event: Event) => void> = new Map();
  let isEnabled = false;
  
  const handleSwipe = (event: TouchEvent): void => {
    const touch = event.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    
    const onMove = (moveEvent: TouchEvent): void => {
      const moveTouch = moveEvent.touches[0];
      const deltaX = moveTouch.clientX - startX;
      const deltaY = moveTouch.clientY - startY;
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const direction = deltaX > 0 ? 'right' : 'left';
        const htmlElement = element as HTMLElement;
        htmlElement.style.transform = `translateX(${deltaX}px) translateZ(0)`;
      } else {
        const direction = deltaY > 0 ? 'down' : 'up';
        const htmlElement = element as HTMLElement;
        htmlElement.style.transform = `translateY(${deltaY}px) translateZ(0)`;
      }
    };
    
    const onEnd = (endEvent: TouchEvent): void => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      
      const htmlElement = element as HTMLElement;
      htmlElement.style.transform = 'translateX(0) translateY(0) translateZ(0)';
      
      const swipeConfig = gestures.find(g => g.gesture === 'swipe');
      if (swipeConfig) {
        triggerAnimation(swipeConfig.animation);
      }
    };
    
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
  };
  
  const handlePinch = (event: TouchEvent): void => {
    if (event.touches.length !== 2) return;
    
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const initialDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    
    const onMove = (moveEvent: TouchEvent): void => {
      if (moveEvent.touches.length !== 2) return;
      
      const moveTouch1 = moveEvent.touches[0];
      const moveTouch2 = moveEvent.touches[1];
      const currentDistance = Math.hypot(
        moveTouch2.clientX - moveTouch1.clientX,
        moveTouch2.clientY - moveTouch1.clientY
      );
      
      const scale = currentDistance / initialDistance;
      const htmlElement = element as HTMLElement;
      htmlElement.style.transform = `scale(${scale}) translateZ(0)`;
    };
    
    const onEnd = (): void => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      
      const htmlElement = element as HTMLElement;
      htmlElement.style.transform = 'scale(1) translateZ(0)';
      
      const pinchConfig = gestures.find(g => g.gesture === 'pinch');
      if (pinchConfig) {
        triggerAnimation(pinchConfig.animation);
      }
    };
    
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
  };
  
  const handleTap = (): void => {
    const tapConfig = gestures.find(g => g.gesture === 'tap');
    if (tapConfig) {
      triggerAnimation(tapConfig.animation);
    }
  };
  
  const triggerAnimation = (animationType: string): void => {
    switch (animationType) {
      case 'fadeIn':
        animateIn(element);
        break;
      case 'fadeOut':
        animateOut(element);
        break;
      case 'slideLeft':
        animateSlide(element, 'left');
        break;
      case 'slideRight':
        animateSlide(element, 'right');
        break;
      case 'slideUp':
        animateSlide(element, 'up');
        break;
      case 'slideDown':
        animateSlide(element, 'down');
        break;
      case 'pulse':
        animatePulse(element);
        break;
      case 'shake':
        animateShake(element);
        break;
    }
  };
  
  gestures.forEach(config => {
    switch (config.gesture) {
      case 'swipe':
        gestureHandlers.set('swipe', handleSwipe);
        element.addEventListener('touchstart', handleSwipe, { passive: true });
        break;
      case 'pinch':
        gestureHandlers.set('pinch', handlePinch);
        element.addEventListener('touchstart', handlePinch, { passive: true });
        break;
      case 'tap':
        gestureHandlers.set('tap', handleTap);
        element.addEventListener('click', handleTap);
        break;
    }
  });
  
  return {
    enable(): void {
      if (!isEnabled) {
        gestures.forEach(config => {
          const handler = gestureHandlers.get(config.gesture);
          if (handler) {
            if (config.gesture === 'tap') {
              element.addEventListener('click', handler as EventListener);
            } else {
              element.addEventListener('touchstart', handler as EventListener, { passive: true });
            }
          }
        });
        isEnabled = true;
      }
    },
    disable(): void {
      if (isEnabled) {
        gestures.forEach(config => {
          const handler = gestureHandlers.get(config.gesture);
          if (handler) {
            if (config.gesture === 'tap') {
              element.removeEventListener('click', handler as EventListener);
            } else {
              element.removeEventListener('touchstart', handler as EventListener);
            }
          }
        });
        isEnabled = false;
      }
    }
  };
}
