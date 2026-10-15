import {getProfile} from './data.js';

export const isWeChat = userAgent => /MicroMessenger/i.test(userAgent || '');

export function resultURL(base,id){
  if(!getProfile(id))throw new Error('未知的人格结果');
  return new URL(`share/${id}.html`,base).href;
}

export function cardURL(base,id){
  if(!getProfile(id))throw new Error('未知的人格结果');
  return new URL(`assets/cards/${id}.png`,base).href;
}

export function sharedProfile(url){
  const parsed=new URL(url);
  const legacy=getProfile(parsed.searchParams.get('r'));
  const pathId=parsed.pathname.match(/\/share\/([a-z]+)\.html$/)?.[1];
  return legacy||getProfile(pathId);
}

export function makeShareFile(blob,id,FileType=globalThis.File){
  if(!blob||typeof FileType!=='function')return null;
  try{return new FileType([blob],`mcd-personality-${id}.png`,{type:'image/png'});}catch{return null;}
}

export function canShareImage(navigator,file){
  // WeChat's own save/share menus do not share the Web Share API contract.
  if(isWeChat(navigator.userAgent)||!file||typeof navigator.share!=='function'||typeof navigator.canShare!=='function')return false;
  try{return navigator.canShare({files:[file]})===true;}catch{return false;}
}
