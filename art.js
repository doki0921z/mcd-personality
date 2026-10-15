// Original pixel sprites: whole-number rectangles stay crisp in SVG and canvas.
const ink='#593425', gold='#ffc63d', light='#ffe680', red='#ee5143', cream='#fff7df', brown='#985430', dark='#62392d';
const rect=(x,y,w,h,c)=>[x,y,w,h,c];
const face=(x,y)=>[rect(x,y,1,2,ink),rect(x+6,y,1,2,ink),rect(x+2,y+3,3,1,ink),rect(x-2,y+2,2,1,'#f78d7d'),rect(x+7,y+2,2,1,'#f78d7d')];
const bun=(y,h)=>[rect(6,y,20,h,brown),rect(4,y+2,24,h-2,brown),rect(6,y,20,h-2,gold),rect(4,y+2,24,h-4,gold)];
const burger=[rect(8,5,16,2,ink),rect(5,7,22,2,ink),rect(3,9,26,6,ink),rect(5,7,22,6,gold),rect(3,11,26,2,gold),rect(7,9,2,1,cream),rect(14,8,2,1,cream),rect(22,10,2,1,cream),rect(10,11,1,1,cream),rect(3,15,26,3,'#6c9e42'),rect(5,17,22,2,'#c2d451'),rect(3,19,26,4,ink),rect(5,19,22,2,brown),rect(3,23,26,2,'#ffd24f'),rect(5,25,22,3,ink),rect(5,24,22,3,gold),rect(8,27,16,1,ink),...face(12,11)];
export const sprites={
 bigmac:[...burger,rect(3,18,26,2,'#e9a33d'),rect(5,21,22,2,brown)],
 spicy:[...burger,rect(4,19,24,2,'#d05a32'),rect(5,21,22,2,'#ed8b38'),rect(21,2,2,3,red),rect(23,4,2,3,red),rect(21,7,2,2,red)],
 fries:[rect(6,5,3,14,ink),rect(7,3,3,15,gold),rect(11,2,3,16,ink),rect(12,1,3,17,light),rect(17,3,4,15,ink),rect(18,2,3,16,gold),rect(22,5,4,13,ink),rect(22,4,3,14,light),rect(4,15,24,4,ink),rect(5,16,22,8,red),rect(6,24,20,4,ink),rect(7,23,18,5,red),rect(9,28,14,2,ink),rect(10,27,12,2,red),rect(6,17,2,6,'#ff8c64'),...face(12,19)],
 nuggets:[rect(3,15,26,3,ink),rect(5,17,22,11,ink),rect(6,17,20,9,cream),rect(8,26,16,2,gold),rect(3,9,12,8,ink),rect(5,7,8,12,ink),rect(4,10,10,6,gold),rect(6,8,6,10,'#e7a03b'),rect(17,6,10,12,ink),rect(15,8,14,8,ink),rect(17,7,10,10,gold),rect(16,9,12,6,'#e7a03b'),rect(7,10,2,1,light),rect(20,9,3,1,light),...face(12,20)],
 mcflurry:[rect(17,1,3,15,ink),rect(18,1,1,14,'#b1a4bd'),rect(8,4,17,3,ink),rect(5,7,23,4,ink),rect(6,7,21,6,cream),rect(9,4,15,3,cream),rect(5,11,23,3,ink),rect(7,14,19,14,ink),rect(8,14,17,13,'#c8b9dc'),rect(9,16,15,2,cream),rect(10,27,13,3,ink),rect(11,27,11,2,'#b19cc9'),rect(10,7,3,2,dark),rect(21,8,3,3,dark),rect(15,10,2,2,dark),rect(7,10,2,1,dark),...face(13,19)],
 pie:[rect(5,6,22,3,ink),rect(3,9,26,15,ink),rect(5,7,22,17,'#e7ad60'),rect(4,10,24,12,gold),rect(6,24,20,3,ink),rect(7,23,18,3,'#ca8d44'),rect(6,11,2,10,light),rect(24,11,2,10,'#db9849'),rect(10,9,3,1,brown),rect(17,9,3,1,brown),rect(22,10,2,2,'#af89b6'),...face(12,15)],
 cola:[rect(20,1,3,9,ink),rect(18,1,5,2,red),rect(19,2,2,8,red),rect(6,8,22,3,ink),rect(5,10,24,3,cream),rect(7,13,20,15,ink),rect(8,13,18,13,red),rect(10,26,14,3,ink),rect(11,26,12,2,red),rect(9,14,2,10,'#ff8b68'),rect(13,15,10,3,cream),...face(13,20)],
 coffee:[rect(8,10,19,3,ink),rect(6,12,23,3,ink),rect(7,11,21,2,cream),rect(8,15,19,12,ink),rect(9,15,17,11,'#f4e1b8'),rect(11,25,13,4,ink),rect(12,25,11,3,'#c8ab7d'),rect(10,18,15,5,brown),...face(14,18),rect(10,4,2,4,'#c6a887'),rect(12,2,2,2,'#c6a887'),rect(20,3,2,4,'#c6a887'),rect(18,1,2,2,'#c6a887')]
};
export function spriteSVG(id,cls='') {
 const rects=(sprites[id]||sprites.fries).map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');
 return `<svg class="pixel-art ${cls}" viewBox="0 0 32 32" aria-hidden="true" shape-rendering="crispEdges">${rects}</svg>`;
}
export function drawSprite(ctx,id,x,y,size){const scale=size/32;ctx.imageSmoothingEnabled=false;(sprites[id]||sprites.fries).forEach(([rx,ry,w,h,c])=>{ctx.fillStyle=c;ctx.fillRect(x+rx*scale,y+ry*scale,w*scale,h*scale);});}
