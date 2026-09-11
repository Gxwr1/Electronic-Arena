import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Trash2, Plus, Lock, Unlock, Cpu, Sparkles, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';
import { COMPONENTS } from '../data/components';

export function CircuitSimulator({ currentTeam, showToast }) {
  const [elements, setElements] = useState([
    { id: 'in_1', type: 'Input', name: 'Input A', x: 80, y: 120, state: 1, inputs: [], outputs: [1] },
    { id: 'in_2', type: 'Input', name: 'Input B', x: 80, y: 220, state: 1, inputs: [], outputs: [1] },
    { id: 'gate_1', type: 'AND Gate', name: 'AND Gate', x: 260, y: 160, state: 1, inputs: [1, 1], outputs: [1] },
    { id: 'out_1', type: 'LED Light', name: 'Output LED', x: 440, y: 170, state: 1, inputs: [1], outputs: [] },
  ]);

  const [wires, setWires] = useState([
    { id: 'w_1', from: 'in_1', fromPin: 0, to: 'gate_1', toPin: 0, state: 1 },
    { id: 'w_2', from: 'in_2', fromPin: 0, to: 'gate_1', toPin: 1, state: 1 },
    { id: 'w_3', from: 'gate_1', fromPin: 0, to: 'out_1', toPin: 0, state: 1 },
  ]);

  const [connectingPin, setConnectingPin] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isSandbox, setIsSandbox] = useState(false);
  const [clockTick, setClockTick] = useState(0);

  // Won component names
  const wonNames = new Set((currentTeam?.players || []).map((p) => p.name));

  // Clock generator loop
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick((t) => (t + 1) % 1000);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // 60Hz Logic evaluation
  useEffect(() => {
    setElements((prevElements) => {
      const elMap = new Map(prevElements.map((el) => [el.id, { ...el }]));

      // 1. Gather wire inputs
      prevElements.forEach((el) => {
        el.inputs = [];
      });

      wires.forEach((w) => {
        const source = elMap.get(w.from);
        const target = elMap.get(w.to);
        if (source && target) {
          const sourceVal = source.outputs[w.fromPin] ?? source.state ?? 0;
          w.state = sourceVal;
          if (!target.inputs) target.inputs = [];
          target.inputs[w.toPin] = sourceVal;
        }
      });

      // 2. Evaluate gates
      prevElements.forEach((el) => {
        const ins = el.inputs || [];
        const in0 = ins[0] ?? 0;
        const in1 = ins[1] ?? 0;

        switch (el.type) {
          case 'Input':
          case 'Constant Value':
            el.outputs = [el.state ?? 0];
            break;
          case 'Button (Red)':
            el.outputs = [el.state ?? 0];
            break;
          case 'Power (+V)':
            el.state = 1;
            el.outputs = [1];
            break;
          case 'Ground':
            el.state = 0;
            el.outputs = [0];
            break;
          case 'Clock':
            const clkVal = clockTick % 2;
            el.state = clkVal;
            el.outputs = [clkVal];
            break;
          case 'AND Gate':
            const andVal = (in0 === 1 && in1 === 1) ? 1 : 0;
            el.state = andVal;
            el.outputs = [andVal];
            break;
          case 'OR Gate':
            const orVal = (in0 === 1 || in1 === 1) ? 1 : 0;
            el.state = orVal;
            el.outputs = [orVal];
            break;
          case 'XOR Gate':
            const xorVal = (in0 !== in1) ? 1 : 0;
            el.state = xorVal;
            el.outputs = [xorVal];
            break;
          case 'NAND Gate':
            const nandVal = !(in0 === 1 && in1 === 1) ? 1 : 0;
            el.state = nandVal;
            el.outputs = [nandVal];
            break;
          case 'NOR Gate':
            const norVal = !(in0 === 1 || in1 === 1) ? 1 : 0;
            el.state = norVal;
            el.outputs = [norVal];
            break;
          case 'XNOR Gate':
            const xnorVal = (in0 === in1) ? 1 : 0;
            el.state = xnorVal;
            el.outputs = [xnorVal];
            break;
          case 'NOT Gate':
          case 'Controller Inverter':
            const notVal = in0 === 1 ? 0 : 1;
            el.state = notVal;
            el.outputs = [notVal];
            break;
          case 'Buffer':
            el.state = in0;
            el.outputs = [in0];
            break;
          case 'Multiplexer (2:1)':
            // in0 = D0, in1 = D1, in2 = Sel
            const sel = ins[2] ?? 0;
            const muxVal = sel === 1 ? in1 : in0;
            el.state = muxVal;
            el.outputs = [muxVal];
            break;
          case 'D Flip-Flop':
            // in0 = D, in1 = CLK
            if (ins[1] === 1) {
              el.state = in0;
            }
            el.outputs = [el.state ?? 0, (el.state === 1 ? 0 : 1)];
            break;
          case 'LED Light':
          case 'RGB Light':
          case 'Seven Segment Display':
          case 'Hex Display':
          case 'Test Bench Output':
            el.state = in0;
            break;
          default:
            el.state = in0;
            el.outputs = [in0];
        }
      });

      return [...prevElements];
    });
  }, [clockTick, wires.length]);

  const addComponent = (comp) => {
    const isUnlocked = isSandbox || wonNames.has(comp.name);
    if (!isUnlocked) {
      showToast(`🔒 "${comp.name}" is locked. Win it in the auction to use it!`, 'error');
      return;
    }

    const newId = 'el_' + Math.random().toString(36).substring(2, 8);
    const newEl = {
      id: newId,
      type: comp.name,
      name: comp.name,
      x: 150 + Math.random() * 300,
      y: 100 + Math.random() * 200,
      state: 0,
      inputs: [],
      outputs: [0],
    };

    setElements((prev) => [...prev, newEl]);
    showToast(`Added ${comp.name} to circuit`, 'info');
  };

  const toggleInputState = (id) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, state: el.state === 1 ? 0 : 1 } : el))
    );
  };

  const handlePinClick = (elementId, pinIndex, type) => {
    if (!connectingPin) {
      if (type === 'output') {
        setConnectingPin({ elementId, pinIndex });
        showToast('Click an input terminal to complete wire', 'info');
      }
    } else {
      if (type === 'input' && connectingPin.elementId !== elementId) {
        const newWire = {
          id: 'w_' + Math.random().toString(36).substring(2, 8),
          from: connectingPin.elementId,
          fromPin: connectingPin.pinIndex,
          to: elementId,
          toPin: pinIndex,
          state: 0,
        };
        setWires((prev) => [...prev, newWire]);
        setConnectingPin(null);
        showToast('Wire connected!', 'success');
      } else {
        setConnectingPin(null);
      }
    }
  };

  const clearCircuit = () => {
    if (!window.confirm('Clear all components from canvas?')) return;
    setElements([]);
    setWires([]);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setWires((prev) => prev.filter((w) => w.from !== selectedId && w.to !== selectedId));
    setSelectedId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-purple-500/30 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl shadow-purple-500/10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs font-mono-code text-purple-300 mb-2">
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span>60Hz Real-Time Logic Engine</span>
          </div>
          <h1 className="font-bebas text-3xl sm:text-5xl tracking-wider text-slate-100">
            INTERACTIVE CIRCUIT SIMULATOR
          </h1>
          <p className="text-xs font-rajdhani text-slate-400">
            {isSandbox ? (
              <span className="text-emerald-400 font-bold">✨ Sandbox Mode Enabled: All 53 components unlocked</span>
            ) : (
              <span>Inventory Restriction: Components locked to team's won auction inventory</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsSandbox(!isSandbox)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-rajdhani font-bold border transition-all ${
              isSandbox
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            {isSandbox ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            <span>{isSandbox ? 'Sandbox Mode: ON' : 'Inventory Mode: ON'}</span>
          </button>

          {selectedId && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 px-3 py-2 text-xs font-rajdhani font-bold transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          )}

          <button
            onClick={clearCircuit}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 text-xs font-rajdhani font-bold transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Simulator Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Component Palette (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bebas text-xl text-slate-200 tracking-wider">
                COMPONENT PALETTE
              </h3>
              <span className="text-[10px] font-mono-code text-cyan-400">
                {isSandbox ? '53 Available' : `${wonNames.size} Unlocked`}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {COMPONENTS.map((comp) => {
                const isUnlocked = isSandbox || wonNames.has(comp.name);
                return (
                  <button
                    key={comp.id}
                    onClick={() => addComponent(comp)}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl p-2.5 text-left border transition-all ${
                      isUnlocked
                        ? 'bg-slate-950/70 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 text-slate-200 cursor-pointer'
                        : 'bg-slate-950/30 border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <img src={comp.image} alt="" className="h-6 w-6 object-contain shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-rajdhani font-bold truncate">{comp.name}</div>
                        <div className="text-[10px] font-mono-code text-slate-500">{comp.role}</div>
                      </div>
                    </div>
                    {isUnlocked ? (
                      <Plus className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Canvas (9 cols) */}
        <div className="lg:col-span-9">
          <div className="relative rounded-3xl border border-slate-800 bg-slate-950 min-h-[620px] p-6 shadow-2xl overflow-hidden select-none">
            {/* Background Grid Lines */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-20">
              <defs>
                <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Render Wires */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              {wires.map((w) => {
                const source = elements.find((e) => e.id === w.from);
                const target = elements.find((e) => e.id === w.to);
                if (!source || !target) return null;

                const sx = source.x + 130;
                const sy = source.y + 35;
                const tx = target.x;
                const ty = target.y + 25 + (w.toPin * 20);

                const isHigh = w.state === 1;

                return (
                  <g key={w.id}>
                    <path
                      d={`M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 50} ${ty}, ${tx} ${ty}`}
                      fill="none"
                      stroke={isHigh ? '#00ff88' : '#334155'}
                      strokeWidth={isHigh ? '3' : '2'}
                      strokeLinecap="round"
                      className="transition-colors duration-200"
                    />
                    {isHigh && (
                      <circle cx={(sx + tx) / 2} cy={(sy + ty) / 2} r="3" fill="#00ff88" className="animate-ping" />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Elements on Board */}
            {elements.map((el) => {
              const isSelected = selectedId === el.id;
              const isHigh = el.state === 1;

              return (
                <div
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  style={{ transform: `translate3d(${el.x}px, ${el.y}px, 0)` }}
                  className={`absolute rounded-2xl border p-3 backdrop-blur-md cursor-move w-36 transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-slate-900 shadow-lg shadow-cyan-500/20 z-20'
                      : 'border-slate-800 bg-slate-900/90 hover:border-slate-700 z-10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-rajdhani font-bold text-slate-200 truncate">
                      {el.name}
                    </span>
                    {el.type.includes('Input') || el.type.includes('Button') ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleInputState(el.id);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                          isHigh ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isHigh ? 'HIGH (1)' : 'LOW (0)'}
                      </button>
                    ) : (
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        isHigh ? 'bg-emerald-400 shadow-[0_0_8px_#00ff88]' : 'bg-slate-700'
                      }`} />
                    )}
                  </div>

                  {/* Pin connection points */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80 text-[10px] font-mono-code">
                    {/* Inputs */}
                    <div className="flex flex-col gap-1">
                      {['In 1', 'In 2'].map((label, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinClick(el.id, idx, 'input');
                          }}
                          className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 p-0.5 rounded"
                        >
                          <span className="h-2 w-2 rounded-full bg-slate-700 hover:bg-cyan-400" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Output */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePinClick(el.id, 0, 'output');
                      }}
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 p-0.5 rounded"
                    >
                      <span>Out</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 hover:bg-emerald-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
