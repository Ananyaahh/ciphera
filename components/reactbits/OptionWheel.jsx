import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import './OptionWheel.css';

const DEFAULT_ITEMS = [
  'Ambient',
  'House',
  'Techno',
  'Jazz',
  'Lo-Fi',
  'Synthwave',
  'Trance',
  'Funk',
  'Disco',
  'Hip-Hop',
  'Chillwave',
  'Drum & Bass'
];

// Design note: earlier revisions eased the wheel's position with a custom
// requestAnimationFrame loop mutating a separate "animated position" ref/state.
// That added a whole extra layer (ref population timing, effect ordering,
// rAF scheduling) between "user clicks an item" and "the wheel visually
// shows it selected" -- exactly the kind of layer where the visual state and
// the reported selection can drift apart. This version has no separate
// animated-position state at all: what's rendered is always a direct,
// synchronous function of the current index (or the live pointer position
// while actively dragging), and the smooth motion between two indices comes
// from a plain CSS transition instead of hand-rolled physics.
const OptionWheel = ({
  items = DEFAULT_ITEMS,
  defaultSelected = 3,
  selectedIndex: controlledIndex,
  onChange,
  textColor = '#a6a6a6',
  activeColor = '#ffffff',
  side = 'left',
  fontSize = 3,
  spacing = 1.4,
  curve = 1,
  tilt = 6,
  blur = 2,
  fade = 0.25,
  minOpacity = 0.05,
  smoothing = 200,
  inset = 80,
  loop = false,
  draggable = true,
  soundUrl = '',
  soundVolume = 0.5,
  className = ''
}) => {
  const rootRef = useRef(null);
  const cfgRef = useRef({});
  const onChangeRef = useRef(onChange);
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const wheelAccumRef = useRef(0);
  const wheelSettleTimerRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef('');
  const lastTickRef = useRef(0);

  const isControlled = controlledIndex != null;
  const [internalIndex, setInternalIndex] = useState(defaultSelected);
  const currentIndex = isControlled ? controlledIndex : internalIndex;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const [isDragging, setIsDragging] = useState(false);
  // Non-null only while a real drag gesture is in progress -- a continuous
  // (fractional) position that follows the pointer 1:1. Null the rest of
  // the time, when the wheel simply renders at `currentIndex`.
  const [dragValue, setDragValue] = useState(null);

  const remPx = typeof window !== 'undefined' ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16 : 16;

  onChangeRef.current = onChange;
  cfgRef.current = {
    count: items.length,
    items,
    rowH: Math.max(fontSize * spacing * remPx, 1),
    curve,
    tilt,
    blur,
    fade,
    minOpacity,
    side,
    loop,
    draggable,
    soundUrl,
    soundVolume
  };

  // Optional tick on selection change, throttled so fast scrolling can't spam
  // it, and with playback failures (e.g. autoplay policies) silently ignored.
  const playTick = useCallback(() => {
    const { soundUrl, soundVolume } = cfgRef.current;
    if (!soundUrl) return;
    const now = performance.now();
    if (now - lastTickRef.current < 70) return;
    lastTickRef.current = now;
    if (!audioRef.current || audioUrlRef.current !== soundUrl) {
      audioRef.current = new Audio(soundUrl);
      audioRef.current.preload = 'auto';
      audioUrlRef.current = soundUrl;
    }
    const audio = audioRef.current;
    audio.volume = Math.min(Math.max(soundVolume, 0), 1);
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  }, []);

  const normalizeIndex = useCallback(v => {
    const cfg = cfgRef.current;
    return ((Math.round(v) % cfg.count) + cfg.count) % cfg.count;
  }, []);

  // The single place a new selection actually gets applied. In uncontrolled
  // mode it updates local state directly; in controlled mode it only tells
  // the consumer -- the next render then reflects whatever the consumer
  // decides `selectedIndex` should be. Either way, `onChange` and the
  // visual "selected" item are driven by the exact same value.
  const commit = useCallback(
    idx => {
      if (idx === currentIndexRef.current) return;
      if (!isControlled) setInternalIndex(idx);
      onChangeRef.current?.(idx, cfgRef.current.items[idx]);
      playTick();
    },
    [isControlled, playTick]
  );

  const selectByDelta = useCallback(
    deltaSteps => {
      const cfg = cfgRef.current;
      let next = currentIndexRef.current + deltaSteps;
      if (cfg.loop) {
        next = ((next % cfg.count) + cfg.count) % cfg.count;
      } else {
        next = Math.min(Math.max(next, 0), cfg.count - 1);
      }
      commit(next);
    },
    [commit]
  );

  // Wheel / touchpad scrolling, registered manually so it can be non-passive.
  // Deltas accumulate until they cross one row's worth of distance, then
  // advance exactly one option -- so a notchy mouse wheel moves one option
  // per click, while a touchpad's continuous stream still steps cleanly.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const cfg = cfgRef.current;
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
      wheelAccumRef.current += delta;
      const threshold = cfg.rowH;
      let guard = 0;
      while (Math.abs(wheelAccumRef.current) >= threshold && guard < 8) {
        const step = wheelAccumRef.current > 0 ? 1 : -1;
        selectByDelta(step);
        wheelAccumRef.current -= step * threshold;
        guard++;
      }
      if (wheelSettleTimerRef.current) clearTimeout(wheelSettleTimerRef.current);
      wheelSettleTimerRef.current = setTimeout(() => {
        wheelAccumRef.current = 0;
      }, 160);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelSettleTimerRef.current) clearTimeout(wheelSettleTimerRef.current);
    };
  }, [selectByDelta]);

  const handlePointerDown = useCallback(e => {
    if (!cfgRef.current.draggable) return;
    dragRef.current = { y: e.clientY, startIndex: currentIndexRef.current, id: e.pointerId };
    dragMovedRef.current = false;
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(e => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!dragMovedRef.current && Math.abs(dy) > 4) {
      dragMovedRef.current = true;
      rootRef.current?.setPointerCapture(drag.id);
    }
    if (dragMovedRef.current) {
      const cfg = cfgRef.current;
      let v = drag.startIndex - dy / cfg.rowH;
      if (!cfg.loop) v = Math.min(Math.max(v, 0), Math.max(cfg.count - 1, 0));
      setDragValue(v);
    }
  }, []);

  const handlePointerEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    setDragValue(current => {
      if (dragMovedRef.current && current != null) {
        commit(normalizeIndex(current));
      }
      return null;
    });
  }, [commit, normalizeIndex]);

  const handleItemClick = useCallback(
    index => {
      if (dragMovedRef.current) return;
      commit(index);
    },
    [commit]
  );

  const handleKeyDown = useCallback(
    e => {
      let delta = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1;
      if (delta == null) return;
      e.preventDefault();
      selectByDelta(delta);
    },
    [selectByDelta]
  );

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    []
  );

  // What actually gets rendered: the live drag position while dragging,
  // otherwise the current (possibly externally-controlled) index. Every
  // item's transform/opacity/filter is a pure function of this single value.
  const renderPos = dragValue != null ? dragValue : currentIndex;

  const itemStyles = useMemo(() => {
    const cfg = cfgRef.current;
    const n = cfg.count;
    const mirror = cfg.side === 'right' ? -1 : 1;
    const tiltRad = (cfg.tilt * Math.PI) / 180;
    const R = tiltRad > 0.0005 ? cfg.rowH / tiltRad : 0;
    const styles = [];
    for (let i = 0; i < n; i++) {
      let d = i - renderPos;
      if (cfg.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }
      const dist = Math.abs(d);
      let x = 0;
      let y = d * cfg.rowH;
      let rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        y = R * Math.sin(ang);
        x = -mirror * R * (1 - Math.cos(ang)) * cfg.curve;
        rot = (mirror * ang * 180) / Math.PI;
      }
      styles.push({
        transform: `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`,
        opacity: Math.max(cfg.minOpacity, 1 - dist * cfg.fade),
        filter: cfg.blur > 0 ? `blur(${(dist * cfg.blur).toFixed(2)}px)` : 'none',
        '--ow-p': Math.max(0, 1 - Math.min(dist, 1)).toFixed(4)
      });
    }
    return styles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderPos, items, fontSize, spacing, curve, tilt, blur, fade, minOpacity, side, loop]);

  return (
    <div
      ref={rootRef}
      role="listbox"
      tabIndex={0}
      aria-label="Option wheel"
      className={`option-wheel${side === 'right' ? ' option-wheel--right' : ''}${isDragging ? ' option-wheel--dragging' : ''}${className ? ` ${className}` : ''}`}
      style={{
        '--ow-text-color': textColor,
        '--ow-active-color': activeColor,
        '--ow-font-size': `${fontSize}rem`,
        '--ow-inset': `${inset}px`,
        '--ow-duration': `${Math.max(smoothing, 0)}ms`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      {items.map((label, index) => (
        <div
          key={`${label}-${index}`}
          role="option"
          aria-selected={currentIndex === index}
          className={`option-wheel__item${currentIndex === index ? ' option-wheel__item--selected' : ''}`}
          style={itemStyles[index]}
          onClick={() => handleItemClick(index)}
        >
          {label}
        </div>
      ))}
    </div>
  );
};

export default OptionWheel;
