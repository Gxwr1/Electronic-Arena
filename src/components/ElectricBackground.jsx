import React, { useEffect, useRef } from 'react';

export function ElectricBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Generate PCB Grid Nodes and Circuit Traces
    const gridSize = 60;
    const cols = Math.ceil(width / gridSize) + 1;
    const rows = Math.ceil(height / gridSize) + 1;

    // Pulses traveling along circuit paths
    const pulses = [];
    const maxPulses = 35;

    class CircuitPulse {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.floor(Math.random() * cols) * gridSize;
        this.y = Math.floor(Math.random() * rows) * gridSize;
        this.dir = Math.floor(Math.random() * 4); // 0: right, 1: down, 2: left, 3: up
        this.length = Math.random() * 40 + 20;
        this.speed = Math.random() * 2.5 + 1.5;
        this.life = Math.random() * 200 + 100;
        this.color = Math.random() > 0.4 ? '#00e5ff' : '#00ff88';
        this.history = [];
      }

      update() {
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > 8) this.history.shift();

        // 90-degree circuit turn probability
        if (Math.random() < 0.04) {
          this.dir = (this.dir + (Math.random() > 0.5 ? 1 : 3)) % 4;
        }

        switch (this.dir) {
          case 0: this.x += this.speed; break;
          case 1: this.y += this.speed; break;
          case 2: this.x -= this.speed; break;
          case 3: this.y -= this.speed; break;
        }

        this.life--;
        if (this.life <= 0 || this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) {
          this.reset();
        }
      }

      draw(context) {
        if (this.history.length < 2) return;
        context.beginPath();
        context.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
          context.lineTo(this.history[i].x, this.history[i].y);
        }
        context.strokeStyle = this.color;
        context.lineWidth = 2;
        context.shadowColor = this.color;
        context.shadowBlur = 8;
        context.stroke();

        // Glowing pulse head
        context.beginPath();
        context.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
        context.fillStyle = '#ffffff';
        context.shadowColor = this.color;
        context.shadowBlur = 12;
        context.fill();
      }
    }

    for (let i = 0; i < maxPulses; i++) {
      pulses.push(new CircuitPulse());
    }

    // Floating Logic Gate Icons & Nodes
    const logicSymbols = ['AND', 'OR', 'XOR', 'NAND', 'NOT', 'CLK', 'D-FF', '7-SEG', 'MUX', '1', '0'];
    const floatingNodes = Array.from({ length: 18 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      symbol: logicSymbols[Math.floor(Math.random() * logicSymbols.length)],
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 12 + 10,
      opacity: Math.random() * 0.35 + 0.1,
    }));

    const render = () => {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle PCB grid dots
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const gx = c * gridSize;
          const gy = r * gridSize;
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw and update pulses
      pulses.forEach((p) => {
        p.update();
        p.draw(ctx);
      });

      // Draw floating logic symbols
      floatingNodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0) node.x = width;
        if (node.x > width) node.x = 0;
        if (node.y < 0) node.y = height;
        if (node.y > height) node.y = 0;

        ctx.font = `${node.size}px 'Fira Code', monospace`;
        ctx.fillStyle = `rgba(0, 229, 255, ${node.opacity})`;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 6;
        ctx.fillText(`[ ${node.symbol} ]`, node.x, node.y);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: '#030712' }}
    />
  );
}
