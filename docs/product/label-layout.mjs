export function placeRelationLabels(segments,obstacles){
  const occupied=[...obstacles],result=[];
  for(const segment of segments){
    const {from,to}=segment,length=Math.max(1,Math.hypot(to[0]-from[0],to[1]-from[1])),normal=[-(to[1]-from[1])/length,(to[0]-from[0])/length];let best=null,bestScore=Infinity;
    for(const fraction of [.5,.38,.62,.27,.73])for(const offset of [-10,10,-24,24,-38,38]){
      const x=from[0]+(to[0]-from[0])*fraction+normal[0]*offset,y=from[1]+(to[1]-from[1])*fraction+normal[1]*offset,box={left:x-18,right:x+18,top:y-11,bottom:y+11};let score=Math.abs(fraction-.5)*20+Math.abs(offset)*.08;
      for(const other of occupied){const width=Math.min(box.right,other.right)-Math.max(box.left,other.left),height=Math.min(box.bottom,other.bottom)-Math.max(box.top,other.top);if(width>0&&height>0)score+=width*height;}
      if(score<bestScore){bestScore=score;best={...segment,x,y,box};}
    }
    occupied.push(best.box);result.push(best);
  }
  return result;
}
