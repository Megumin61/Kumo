// Keep each paper colour and grain; v25 removes ambient gradient washes.
// Grain is a background image, never a layer above the node artwork.
function grain(size,frequency,rgb,alpha){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="2"/><feColorMatrix values="0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} 0 0 0 ${alpha} 0"/></filter><rect width="${size}" height="${size}" filter="url(#n)"/></svg>`;return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';}
export const fixedPaperSurfaces={
 paperlight:{color:'#fcfaef',image:grain(220,.85,[.42,.36,.22],.03),size:'220px 220px',repeat:'repeat'},
 pencilpaper:{color:'#fcf8ee',image:grain(240,.55,[.45,.38,.25],.048),size:'240px 240px',repeat:'repeat'},
 'woodland-seal':{color:'#f7f2df',image:grain(220,.7,[.46,.43,.26],.035),size:'220px 220px',repeat:'repeat'},
 'green-crayon':{color:'#f3eddd',image:grain(240,.78,[.38,.43,.28],.05),size:'240px 240px',repeat:'repeat'},
 'daily-doodle':{color:'#faf1de',image:grain(260,.6,[.48,.4,.29],.025),size:'260px 260px',repeat:'repeat'},
 'field-guide':{color:'#f5f2e8',image:grain(280,.7,[.45,.47,.36],.018),size:'280px 280px',repeat:'repeat'},
 'camping-pop':{color:'#fffaf0',image:grain(260,.62,[.56,.47,.3],.016),size:'260px 260px',repeat:'repeat'}
};
export function paperSurface(theme,style){return fixedPaperSurfaces[theme]||{color:style.palette[0],image:'url("'+style.paper+'")',size:'cover',repeat:'no-repeat'};}
