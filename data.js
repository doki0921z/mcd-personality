export const profiles = [
  {id:'bigmac',name:'巨无霸',english:'THE BIG MAC',role:'稳稳的可靠派',quote:'世界再大，也有我稳稳接住你。',description:'你是朋友圈里的定海神针。心里有主意，行动有章法，不用刻意抢镜，也能让人安心。你的温柔，是把每一件小事认真做好。',tags:['经典耐看','靠谱担当','内核稳定'],color:'#efac45',buddy:'mcflurry',recipe:'两层靠谱 + 一片温柔 + 满满安全感'},
  {id:'fries',name:'麦当劳薯条',english:'THE HAPPY FRIES',role:'人间快乐充电宝',quote:'快乐这件事，就是要趁热分享呀。',description:'你总能把普通的一天过得热气腾腾。有你在，冷场会变热闹，小事也值得庆祝。你的超能力，是让身边的人都松弛一点。',tags:['气氛组长','分享欲爆棚','快乐传染'],color:'#ef5542',buddy:'coffee',recipe:'一把热情 + 一撮俏皮 + 无限分享欲'},
  {id:'nuggets',name:'麦乐鸡',english:'THE COZY NUGGETS',role:'随时在线的暖心搭子',quote:'不用说太多，你的奇奇怪怪我都懂。',description:'你不一定最张扬，却总是很好相处。能接住朋友的碎碎念，也能认真陪人发呆。和你在一起，不必假装有趣，舒服就已经很珍贵。',tags:['好相处体质','默契搭子','温柔接梗'],color:'#d59d55',buddy:'cola',recipe:'一份默契 + 两勺包容 + 刚刚好的陪伴'},
  {id:'spicy',name:'麦辣鸡腿汉堡',english:'THE SPICY EXPLORER',role:'热烈生活的冒险家',quote:'生活要有点辣，故事才值得讲。',description:'你对世界始终保留着“想试试”的冲动。新路线、新爱好、新朋友，都可能点亮你的一天。心动就出发，是你给生活的认真回应。',tags:['说走就走','敢想敢试','热烈真诚'],color:'#f5784c',buddy:'pie',recipe:'一大口勇气 + 热烈好奇心 + 不设限'},
  {id:'mcflurry',name:'奥利奥麦旋风',english:'THE DREAMY MCFLURRY',role:'脑袋里有小宇宙',quote:'把日子搅一搅，总会冒出新甜头。',description:'你的脑袋里藏着柔软又有趣的小宇宙。偶尔天马行空，偶尔安静发呆，却总能发现生活被忽略的可爱。你的灵感，是给日常加的一点糖。',tags:['灵感制造机','甜酷反差','想象力满格'],color:'#9894c9',buddy:'bigmac',recipe:'一勺想象 + 甜甜反差 + 小小不按常理'},
  {id:'pie',name:'香芋派',english:'THE WARM TARO PIE',role:'慢慢发光的温柔派',quote:'慢一点也没关系，温柔自有它的速度。',description:'你喜欢把小日子过得有温度。熟悉的角落、惦记的人、刚刚好的节奏，都能给你能量。看起来安静，心里却住着一整个暖暖的世界。',tags:['温柔慢热','细节收藏家','长情选手'],color:'#b494bd',buddy:'spicy',recipe:'酥酥的外壳 + 软软的心 + 长久的惦记'},
  {id:'cola',name:'冰可乐',english:'THE FREE-SPIRIT COLA',role:'自由冒泡的灵魂',quote:'允许自己，偶尔快乐得不讲道理。',description:'你有自己的节奏，不太喜欢被标准答案框住。烦恼来了就让它冒个泡，日子无聊了就主动制造转弯。自由和新鲜感，是你的快乐补给。',tags:['自由万岁','清爽直接','随性有趣'],color:'#80b8ae',buddy:'nuggets',recipe:'一杯自在 + 满满气泡 + 随时重启的勇气'},
  {id:'coffee',name:'麦咖啡美式',english:'THE MINDFUL COFFEE',role:'清醒自洽的独行侠',quote:'保持清醒，也给自己留一点留白。',description:'你享受专注，也珍惜独处。比起跟着热闹走，你更愿意想清楚什么适合自己。外表淡定，内心有热爱；不必太用力，也能活得很有质感。',tags:['清醒有边界','独处充电','认真生活'],color:'#a18878',buddy:'fries',recipe:'一份专注 + 清醒边界 + 恰到好处的留白'}
];

const option = (text,sub,weights,traits) => ({text,sub,weights,traits});
// Affinities describe playful preferences, never clinical or diagnostic traits.
export const questions = [
  {title:'终于到周五晚上，\n你最想开启哪种快乐？',hint:'忙了一周，先给自己放个小假。',scene:'fries',options:[
    option('把朋友摇出来，快乐要加倍','人凑齐了，故事就开始了',[0,4,2,1,0,0,2,0],[4,3,2,1]),
    option('钻进小窝，打开熟悉的剧','世界静音，自己充电',[2,0,1,0,2,3,0,2],[0,2,0,4]),
    option('临时起意，去没去过的地方','今晚的目的地：未知',[0,1,0,4,1,0,3,0],[4,1,4,0]),
    option('找个安静角落，做喜欢的事','一个人也能把日子过得很香',[1,0,0,0,2,1,0,4],[0,1,2,4])]},
  {title:'如果生活是一份套餐，\n你一定要加上的是什么？',hint:'没有标准答案，选让你心动的那份。',scene:'bigmac',options:[
    option('确定感：熟悉的味道永远可靠','稳定，也是一种高级的快乐',[4,0,1,0,0,2,0,1],[1,2,0,4]),
    option('新鲜感：这次想试试不一样的','隐藏菜单，我先冲！',[0,1,0,4,2,0,2,0],[3,1,4,0]),
    option('陪伴感：和谁一起吃更重要','你在，普通的一餐也很好',[1,2,4,0,0,2,0,0],[2,4,1,2]),
    option('小惊喜：平淡里突然出现的甜','一点点可爱，就能开心很久',[0,1,0,1,4,1,2,0],[2,3,3,1])]},
  {title:'朋友们的群聊里，\n你一般负责什么？',hint:'你的快乐天赋，往往藏在小细节里。',scene:'nuggets',options:[
    option('发起聚会，绝不让快乐冷场','“有人出来玩吗？我请薯条！”',[0,4,1,2,0,0,2,0],[4,3,2,1]),
    option('接住情绪，认真听每一句话','“我在，你慢慢说。”',[1,0,4,0,1,3,0,0],[1,4,1,3]),
    option('给出方案，把事情安排明白','“我查好了，大家看这个。”',[4,0,1,0,0,1,0,3],[1,2,1,4]),
    option('偶尔冒泡，一出现就是神回复','“等等，我有一个离谱的想法。”',[0,1,0,1,4,0,3,1],[2,1,4,1])]},
  {title:'计划突然被打乱了，\n你的第一反应是？',hint:'生活偶尔跳帧，也许会解锁新剧情。',scene:'cola',options:[
    option('来都来了，换条路线也很酷','意外也可以是彩蛋',[0,1,0,4,1,0,3,0],[4,1,4,0]),
    option('先理清情况，再找一个最优解','别急，问题总有办法解决',[4,0,0,0,0,1,0,4],[1,1,1,4]),
    option('看看大家的心情，舒服最重要','比起去哪儿，更在意你们开心',[1,2,4,0,0,3,0,0],[2,4,0,3]),
    option('那就随心情，快乐不需要剧本','今天的我，主打一个自由',[0,2,0,2,3,0,4,0],[3,1,4,0])]},
  {title:'什么样的小瞬间，\n最能让你觉得“真好呀”？',hint:'最后一题啦，你的快乐订单快出炉了。',scene:'mcflurry',options:[
    option('大家笑成一团，时间都忘了','快乐是可以分着吃的',[0,4,3,1,0,0,2,0],[4,4,2,1]),
    option('被记住偏好，被悄悄放在心上','原来我随口说的，你都记得',[2,0,3,0,1,4,0,0],[1,4,0,3]),
    option('做成想做的事，成为更好的自己','给认真生活的自己点个赞',[3,0,0,2,0,0,0,4],[1,1,2,4]),
    option('撞见新风景，发现世界的可爱','心里那盏小灯，叮地亮了',[0,1,0,3,4,1,3,0],[3,2,4,1])]}
];
export const traitLabels = ['快乐能量','温暖浓度','探索欲望','自洽节奏'];
export function calculateResult(answers) {
  if (!Array.isArray(answers) || answers.length!==questions.length || answers.some(a=>!Number.isInteger(a)||a<0||a>3)) throw new Error('请完成全部5道题');
  const scores=profiles.map(()=>0), traits=[0,0,0,0];
  answers.forEach((a,i)=>{const o=questions[i].options[a];o.weights.forEach((v,j)=>scores[j]+=v);o.traits.forEach((v,j)=>traits[j]+=v);});
  // Resolve ties using the most recent preference, keeping repeat tests deterministic.
  const ranked=profiles.map((p,i)=>({id:p.id,index:i,score:scores[i]})).sort((a,b)=>b.score-a.score || questions[4].options[answers[4]].weights[b.index]-questions[4].options[answers[4]].weights[a.index] || a.index-b.index);
  return {profile:profiles[ranked[0].index],traits:traits.map(v=>Math.round(v/20*100)),scores};
}
export const getProfile = id => profiles.find(p=>p.id===id);
