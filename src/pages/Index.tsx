import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface Block {
  type: 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'water' | 'leaves';
  x: number;
  y: number;
  z: number;
}

interface Item {
  type: string;
  count: number;
}

interface Mob {
  id: number;
  x: number;
  y: number;
  z: number;
  health: number;
  type: 'zombie' | 'skeleton';
}

const CHUNK_SIZE = 20;
const RENDER_DISTANCE = 15;
const BLOCK_SIZE = 40;

const generateTerrain = (): Block[] => {
  const blocks: Block[] = [];
  
  for (let x = -CHUNK_SIZE; x < CHUNK_SIZE; x++) {
    for (let z = -CHUNK_SIZE; z < CHUNK_SIZE; z++) {
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      const biomeNoise = Math.sin(x * 0.1) * Math.cos(z * 0.1);
      
      let biome: 'plains' | 'desert' | 'forest' | 'mountains' = 'plains';
      if (biomeNoise > 0.5) biome = 'desert';
      else if (biomeNoise < -0.5) biome = 'forest';
      else if (distanceFromCenter > 15) biome = 'mountains';
      
      const heightNoise = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 2;
      let height = Math.floor(3 + heightNoise);
      
      if (biome === 'mountains') height += 4;
      if (biome === 'desert') height -= 1;
      
      for (let y = 0; y < height; y++) {
        let blockType: Block['type'] = 'dirt';
        
        if (y === height - 1) {
          if (biome === 'desert') blockType = 'sand';
          else if (biome === 'forest' || biome === 'plains') blockType = 'grass';
          else blockType = 'stone';
        } else if (y < height - 3) {
          blockType = 'stone';
        }
        
        blocks.push({ type: blockType, x, y, z });
      }
      
      if (biome === 'forest' && Math.random() > 0.85) {
        for (let ty = height; ty < height + 4; ty++) {
          blocks.push({ type: 'wood', x, y: ty, z });
        }
        for (let lx = -1; lx <= 1; lx++) {
          for (let lz = -1; lz <= 1; lz++) {
            if (Math.abs(lx) + Math.abs(lz) <= 1) {
              blocks.push({ type: 'leaves', x: x + lx, y: height + 4, z: z + lz });
            }
          }
        }
      }
    }
  }
  
  return blocks;
};

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [inventory, setInventory] = useState<Item[]>([
    { type: 'grass', count: 0 },
    { type: 'dirt', count: 0 },
    { type: 'stone', count: 0 },
    { type: 'wood', count: 0 },
  ]);
  const [health, setHealth] = useState(100);
  const [mobs, setMobs] = useState<Mob[]>([]);
  const [camera, setCamera] = useState({ x: 0, y: 10, z: 0, rotX: 0, rotY: 0 });
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  useEffect(() => {
    const terrain = generateTerrain();
    setBlocks(terrain);
    
    const initialMobs: Mob[] = [];
    for (let i = 0; i < 5; i++) {
      initialMobs.push({
        id: i,
        x: Math.random() * 20 - 10,
        y: 5,
        z: Math.random() * 20 - 10,
        health: 20,
        type: Math.random() > 0.5 ? 'zombie' : 'skeleton',
      });
    }
    setMobs(initialMobs);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => new Set(prev).add(e.key.toLowerCase()));
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => {
        const next = new Set(prev);
        next.delete(e.key.toLowerCase());
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === canvas);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        setCamera(prev => ({
          ...prev,
          rotY: (prev.rotY - e.movementX * 0.002) % (Math.PI * 2),
          rotX: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev.rotX - e.movementY * 0.002)),
        }));
      }
    };

    const handleClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      } else {
        const lookVector = {
          x: Math.sin(camera.rotY) * Math.cos(camera.rotX),
          y: Math.sin(camera.rotX),
          z: Math.cos(camera.rotY) * Math.cos(camera.rotX),
        };

        for (let dist = 0; dist < 5; dist += 0.2) {
          const checkX = Math.round(camera.x + lookVector.x * dist);
          const checkY = Math.round(camera.y + lookVector.y * dist);
          const checkZ = Math.round(camera.z + lookVector.z * dist);

          const blockIndex = blocks.findIndex(
            b => Math.round(b.x) === checkX && Math.round(b.y) === checkY && Math.round(b.z) === checkZ
          );

          if (blockIndex !== -1) {
            const removedBlock = blocks[blockIndex];
            setBlocks(prev => prev.filter((_, i) => i !== blockIndex));
            setInventory(prev => {
              const itemIndex = prev.findIndex(item => item.type === removedBlock.type);
              if (itemIndex !== -1) {
                const updated = [...prev];
                updated[itemIndex].count++;
                return updated;
              }
              return prev;
            });
            break;
          }
        }
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [camera, blocks]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMobs(prev => prev.map(mob => {
        const dx = camera.x - mob.x;
        const dz = camera.z - mob.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 10) {
          const speed = 0.05;
          return {
            ...mob,
            x: mob.x + (dx / distance) * speed,
            z: mob.z + (dz / distance) * speed,
          };
        }
        return mob;
      }));

      mobs.forEach(mob => {
        const distance = Math.sqrt(
          Math.pow(camera.x - mob.x, 2) +
          Math.pow(camera.y - mob.y, 2) +
          Math.pow(camera.z - mob.z, 2)
        );
        if (distance < 2) {
          setHealth(prev => Math.max(0, prev - 1));
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [camera, mobs]);

  useEffect(() => {
    const speed = 0.15;
    const moveInterval = setInterval(() => {
      setCamera(prev => {
        let newX = prev.x;
        let newZ = prev.z;
        
        if (keys.has('w')) {
          newX += Math.sin(prev.rotY) * speed;
          newZ += Math.cos(prev.rotY) * speed;
        }
        if (keys.has('s')) {
          newX -= Math.sin(prev.rotY) * speed;
          newZ -= Math.cos(prev.rotY) * speed;
        }
        if (keys.has('a')) {
          newX += Math.cos(prev.rotY) * speed;
          newZ -= Math.sin(prev.rotY) * speed;
        }
        if (keys.has('d')) {
          newX -= Math.cos(prev.rotY) * speed;
          newZ += Math.sin(prev.rotY) * speed;
        }
        
        return { ...prev, x: newX, z: newZ };
      });
    }, 16);

    return () => clearInterval(moveInterval);
  }, [keys]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const allObjects = [
        ...blocks.map(b => ({ ...b, isMob: false })),
        ...mobs.map(m => ({ x: m.x, y: m.y, z: m.z, type: m.type as any, isMob: true, mob: m }))
      ];

      const projected = allObjects
        .map(obj => {
          const dx = obj.x - camera.x;
          const dy = obj.y - camera.y;
          const dz = obj.z - camera.z;
          
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distance > RENDER_DISTANCE) return null;

          const cosY = Math.cos(camera.rotY);
          const sinY = Math.sin(camera.rotY);
          const rx = dx * cosY - dz * sinY;
          const rz = dx * sinY + dz * cosY;

          if (rz < 0.1) return null;

          const cosX = Math.cos(camera.rotX);
          const sinX = Math.sin(camera.rotX);
          const ry = dy * cosX - rz * sinX;

          const scale = (canvas.height / 2) / rz;
          const screenX = canvas.width / 2 + rx * scale;
          const screenY = canvas.height / 2 - ry * scale;
          const size = BLOCK_SIZE * scale;

          return { obj, screenX, screenY, size, distance };
        })
        .filter(p => p !== null)
        .sort((a, b) => b!.distance - a!.distance);

      projected.forEach(p => {
        if (!p) return;
        
        const { obj, screenX, screenY, size } = p;

        if (obj.isMob && 'mob' in obj) {
          const mob = obj.mob as Mob;
          ctx.fillStyle = mob.type === 'zombie' ? '#228B22' : '#F5F5F5';
          ctx.fillRect(screenX - size / 2, screenY - size, size * 0.6, size * 1.5);
          
          ctx.fillStyle = '#FF0000';
          ctx.fillRect(screenX - size / 2, screenY - size * 1.8, size * 0.6 * (mob.health / 20), 3);
        } else {
          const colors: Record<Block['type'], string> = {
            grass: '#22C55E',
            dirt: '#D4A574',
            stone: '#9CA3AF',
            wood: '#92400E',
            sand: '#FDE68A',
            water: '#3B82F6',
            leaves: '#166534',
          };

          ctx.fillStyle = colors[obj.type as Block['type']] || '#000';
          ctx.fillRect(screenX - size / 2, screenY - size / 2, size, size);
          
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX - size / 2, screenY - size / 2, size, size);
        }
      });

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 10, canvas.height / 2);
      ctx.lineTo(canvas.width / 2 + 10, canvas.height / 2);
      ctx.moveTo(canvas.width / 2, canvas.height / 2 - 10);
      ctx.lineTo(canvas.width / 2, canvas.height / 2 + 10);
      ctx.stroke();
    };

    const animationFrame = setInterval(render, 16);
    return () => clearInterval(animationFrame);
  }, [blocks, camera, mobs]);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="w-full h-full cursor-crosshair"
      />
      
      {!isPointerLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Card className="p-8 bg-black/80 backdrop-blur-sm border-purple-500/50 pointer-events-auto">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-white mb-2">Майнкрафт 3D</h1>
              <p className="text-gray-300">Кликните, чтобы начать игру</p>
              <div className="text-sm text-gray-400 space-y-1">
                <p>WASD - движение</p>
                <p>Мышь - осмотр</p>
                <p>ЛКМ - разрушить блок</p>
                <p>1-4 - выбор слота</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 space-y-2">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
          <Icon name="Heart" className="text-red-500" size={20} />
          <Progress value={health} className="w-40" />
          <span className="text-white text-sm font-bold">{health}/100</span>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="flex gap-2">
          {inventory.map((item, index) => (
            <Card
              key={index}
              className={`w-16 h-16 flex flex-col items-center justify-center cursor-pointer transition-all ${
                selectedSlot === index
                  ? 'border-2 border-purple-500 bg-purple-500/20'
                  : 'border border-gray-600 bg-black/60'
              }`}
              onClick={() => setSelectedSlot(index)}
            >
              <div className="text-2xl">{item.type === 'grass' ? '🌱' : item.type === 'dirt' ? '🟫' : item.type === 'stone' ? '⬜' : '🪵'}</div>
              <span className="text-xs text-white font-bold">{item.count}</span>
            </Card>
          ))}
        </div>
      </div>

      <div className="absolute top-4 right-4 space-y-2">
        <Card className="p-4 bg-black/60 backdrop-blur-sm border-gray-600">
          <div className="text-white text-sm space-y-1">
            <p>Враги: {mobs.length}</p>
            <p>Блоков: {blocks.length}</p>
            <p>X: {camera.x.toFixed(1)}</p>
            <p>Z: {camera.z.toFixed(1)}</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
