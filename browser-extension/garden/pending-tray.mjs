// Keep a real pending region and its own posts, without a central root.
export function separatePending(layout){const keys=new Set();for(const p of layout.points.values())if(p.key==='pending'||p.owner==='pending'||p.record?.primary==='pending'){p.detached=true;keys.add(p.key);if(p.key==='pending')p.labelText='待编译收纳';}return keys;}
