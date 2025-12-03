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

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 12;
const BLOCK_SIZE = 40;

const generateTerrain = (): Block[] => {
  const blocks: Block[] = [];
  const seed = Math.floor(Math.random() * 10000);
  
  for (let x = -CHUNK_SIZE; x < CHUNK_SIZE; x++) {
    for (let z = -CHUNK_SIZE; z < CHUNK_SIZE; z++) {
      const biomeNoise = Math.sin(x * 0.15 + seed) * Math.cos(z * 0.15 + seed);
      const heightNoise = Math.sin(x * 0.25) * Math.cos(z * 0.25) + Math.sin(x * 0.1) * 0.5;
      
      let biome: 'plains' | 'desert' | 'forest' | 'mountains' = 'plains';
      if (biomeNoise > 0.4) biome = 'desert';
      else if (biomeNoise < -0.4) biome = 'forest';
      else if (Math.abs(x) > 12 || Math.abs(z) > 12) biome = 'mountains';
      
      let height = Math.floor(3 + heightNoise * 1.5);
      
      if (biome === 'mountains') height += 3;
      if (biome === 'desert') height = Math.max(2, height - 1);
      
      const topBlock = biome === 'desert' ? 'sand' : biome === 'mountains' ? 'stone' : 'grass';
      blocks.push({ type: topBlock, x, y: height - 1, z });
      
      for (let y = 0; y < height - 1; y++) {
        blocks.push({ type: y < height - 3 ? 'stone' : 'dirt', x, y, z });
      }
      
      if (biome === 'forest' && (x + z * 7 + seed) % 11 === 0) {
        for (let ty = 0; ty < 3; ty++) {
          blocks.push({ type: 'wood', x, y: height + ty, z });
        }
        blocks.push({ type: 'leaves', x, y: height + 3, z });
        blocks.push({ type: 'leaves', x: x + 1, y: height + 2, z });
        blocks.push({ type: 'leaves', x: x - 1, y: height + 2, z });
        blocks.push({ type: 'leaves', x, y: height + 2, z: z + 1 });
        blocks.push({ type: 'leaves', x, y: height + 2, z: z - 1 });
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
  const [showMenu, setShowMenu] = useState(true);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isTouching, setIsTouching] = useState(false);

  const blocksRef = useRef<Block[]>([]);
  const mobsRef = useRef<Mob[]>([]);

  useEffect(() => {
    if (blocks.length === 0 && !showMenu) {
      const terrain = generateTerrain();
      setBlocks(terrain);
      blocksRef.current = terrain;
    }
  }, [showMenu]);

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
      if (document.pointerLockElement !== canvas && !showMenu) {
        canvas.requestPointerLock();
      } else if (document.pointerLockElement === canvas) {
        const lookVector = {
          x: Math.sin(camera.rotY) * Math.cos(camera.rotX),
          y: Math.sin(camera.rotX),
          z: Math.cos(camera.rotY) * Math.cos(camera.rotX),
        };

        for (let dist = 0; dist < 5; dist += 0.2) {
          const checkX = Math.round(camera.x + lookVector.x * dist);
          const checkY = Math.round(camera.y + lookVector.y * dist);
          const checkZ = Math.round(camera.z + lookVector.z * dist);

          const currentBlocks = blocksRef.current.length > 0 ? blocksRef.current : blocks;
          const blockIndex = currentBlocks.findIndex(
            b => Math.round(b.x) === checkX && Math.round(b.y) === checkY && Math.round(b.z) === checkZ
          );

          if (blockIndex !== -1) {
            const removedBlock = currentBlocks[blockIndex];
            const newBlocks = currentBlocks.filter((_, i) => i !== blockIndex);
            blocksRef.current = newBlocks;
            setBlocks(newBlocks);
            
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

    let animationId: number;
    const render = () => {
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const visibleBlocks = blocksRef.current.length > 0 ? blocksRef.current : blocks;
      
      const allObjects = [
        ...visibleBlocks.map(b => ({ ...b, isMob: false })),
        ...mobs.map(m => ({ x: m.x, y: m.y, z: m.z, type: m.type as any, isMob: true, mob: m }))
      ];

      const cosY = Math.cos(camera.rotY);
      const sinY = Math.sin(camera.rotY);
      const cosX = Math.cos(camera.rotX);
      const sinX = Math.sin(camera.rotX);

      const projected = allObjects
        .map(obj => {
          const dx = obj.x - camera.x;
          const dy = obj.y - camera.y;
          const dz = obj.z - camera.z;
          
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq > RENDER_DISTANCE * RENDER_DISTANCE) return null;

          const rx = dx * cosY - dz * sinY;
          const rz = dx * sinY + dz * cosY;

          if (rz < 0.1) return null;

          const ry = dy * cosX - rz * sinX;

          const scale = (canvas.height / 2) / rz;
          const screenX = canvas.width / 2 + rx * scale;
          const screenY = canvas.height / 2 - ry * scale;
          const size = BLOCK_SIZE * scale;

          return { obj, screenX, screenY, size, distance: distSq };
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

    const animate = () => {
      render();
      animationId = requestAnimationFrame(animate);
    };
    animate();
    
    return () => cancelAnimationFrame(animationId);
  }, [blocks, camera, mobs]);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="w-full h-full cursor-crosshair"
      />
      
      {showMenu && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sky-400 to-sky-600">
          <Card className="w-full max-w-md mx-4 bg-black/80 backdrop-blur-sm border-purple-500/50">
            <div className="p-8 space-y-6">
              <h1 className="text-5xl font-bold text-white text-center mb-8">Майнкрафт</h1>
              
              <button
                onClick={() => {
                  setShowMenu(false);
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
                }}
                className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white text-xl font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="Gamepad2" size={24} />
                Одиночная игра
              </button>
              
              <button
                disabled
                className="w-full py-4 px-6 bg-gray-600/50 text-gray-400 text-xl font-semibold rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Icon name="Users" size={24} />
                Мультиплеер
                <span className="text-sm">(скоро)</span>
              </button>
              
              <button
                disabled
                className="w-full py-4 px-6 bg-gray-600/50 text-gray-400 text-xl font-semibold rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Icon name="Wrench" size={24} />
                Креатив
                <span className="text-sm">(скоро)</span>
              </button>
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

      {!showMenu && (
        <>
          <div className="absolute bottom-32 left-8 w-32 h-32 md:hidden">
            <div className="relative w-full h-full bg-black/40 backdrop-blur-sm rounded-full border-2 border-gray-600">
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-purple-500/60 rounded-full transition-transform"
                style={{
                  transform: `translate(calc(-50% + ${joystickPos.x * 30}px), calc(-50% + ${joystickPos.y * 30}px))`
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setIsTouching(true);
                  const touch = e.touches[0];
                  setTouchStart({ x: touch.clientX, y: touch.clientY });
                }}
                onTouchMove={(e) => {
                  if (!isTouching) return;
                  e.preventDefault();
                  const touch = e.touches[0];
                  const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const deltaX = (touch.clientX - centerX) / 40;
                  const deltaY = (touch.clientY - centerY) / 40;
                  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                  const maxDistance = 1;
                  if (distance > maxDistance) {
                    setJoystickPos({ x: (deltaX / distance) * maxDistance, y: (deltaY / distance) * maxDistance });
                  } else {
                    setJoystickPos({ x: deltaX, y: deltaY });
                  }
                  
                  const angle = Math.atan2(deltaX, deltaY);
                  const speed = Math.min(distance, maxDistance) * 0.15;
                  setCamera(prev => ({
                    ...prev,
                    x: prev.x + Math.sin(prev.rotY + angle) * speed,
                    z: prev.z + Math.cos(prev.rotY + angle) * speed,
                  }));
                }}
                onTouchEnd={() => {
                  setIsTouching(false);
                  setJoystickPos({ x: 0, y: 0 });
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon name="Move" size={24} className="text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-32 right-8 md:hidden">
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                const lookVector = {
                  x: Math.sin(camera.rotY) * Math.cos(camera.rotX),
                  y: Math.sin(camera.rotX),
                  z: Math.cos(camera.rotY) * Math.cos(camera.rotX),
                };

                for (let dist = 0; dist < 5; dist += 0.2) {
                  const checkX = Math.round(camera.x + lookVector.x * dist);
                  const checkY = Math.round(camera.y + lookVector.y * dist);
                  const checkZ = Math.round(camera.z + lookVector.z * dist);

                  const currentBlocks = blocksRef.current.length > 0 ? blocksRef.current : blocks;
                  const blockIndex = currentBlocks.findIndex(
                    b => Math.round(b.x) === checkX && Math.round(b.y) === checkY && Math.round(b.z) === checkZ
                  );

                  if (blockIndex !== -1) {
                    const removedBlock = currentBlocks[blockIndex];
                    const newBlocks = currentBlocks.filter((_, i) => i !== blockIndex);
                    blocksRef.current = newBlocks;
                    setBlocks(newBlocks);
                    
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
              }}
              className="w-20 h-20 bg-red-600/60 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-red-500 active:bg-red-700/80 transition-colors"
            >
              <Icon name="Pickaxe" size={32} className="text-white" />
            </button>
          </div>

          <div
            className="absolute top-0 right-0 w-1/2 h-full md:hidden"
            onTouchMove={(e) => {
              if (showMenu) return;
              const touch = e.touches[0];
              const deltaX = touch.clientX - touchStart.x;
              const deltaY = touch.clientY - touchStart.y;
              setCamera(prev => ({
                ...prev,
                rotY: (prev.rotY - deltaX * 0.005) % (Math.PI * 2),
                rotX: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev.rotX - deltaY * 0.005)),
              }));
              setTouchStart({ x: touch.clientX, y: touch.clientY });
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              setTouchStart({ x: touch.clientX, y: touch.clientY });
            }}
          />
        </>
      )}
    </div>
  );
};

export default Index;