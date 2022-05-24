"use strict";

importPackage(org.jsoup);

const bot = BotManager.getCurrentBot();
const Kakao = new (require('kaling'))();
const secret = Database.readObject("./secret.json");
try{ //전체 명령어의 카링 로그인에 대한 의존성 방지
  Kakao.init(secret.kakao.key, secret.kakao.domain);
  Kakao.login(secret.kakao.id, secret.kakao.pw);
} 
catch(err) {
  Log.w(err);
};

//기본 명령어 접두사
const globalPrefix = '!';
//특수문자 제거 표현식
const reg = /[\"\[\{\}\[\]\/?\.\,\;\:\|\)\*\~\`\!\^\-\_\+\<\>\@\#\$\%\&\\\=\(\'\"\:\]]/g;
//Eval 권한
const perms = [];
const { CLOUDINARY_CLIENT_ID, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_KEY, GOOGLE_KEY, MATTERS_KEY, SEARCH_ID, GITHUB_KEY } = secret.api;

//Utils
String.prototype.trip = function(step) {
  step = step||1;
  return this.slice(step, this.length-step);
}
Array.prototype.splitIndex = function(index) {
  return [this.slice(0, index), this.slice(index, this.length-1)];
}


//초기화 함수
function init() {
  manager.commands = [
    new BaseCommand("ping", msg=>msg.reply("ping!")),
    new BaseCommand(["help","도움말"], help).addPrefix("%"),
    new BaseCommand("방정보", roomInfo),
    new BaseCommand("재난", disaster, new Option("지역").setOptional()),
    new BaseCommand(["가르치기", "sd"], teach, [new Option("키"), new Option("값")], "::"),
    new BaseCommand(["가르친것", "sdl"], teachList, new Option("만든이").setOptional()),
    new BaseCommand(["상태확인", "status"], status),
    new BaseCommand(["대화기록", "cl"], chatlog, new Option("필터").setOptional()),
    new BaseCommand(["코로나", "corona"], corona),
    new BaseCommand(["검색", "search"], search, [new Option("유형"), new Option("검색어"), new Option("옵션")])
  ];
}

/**
 * 리스트 카링 수신 인자
 * @typedef {Object} ListParameter
 * @property {string} [url] 클릭 시 리다이렉트할 링크
 * @property {string} [title] 타이틀
 * @property {Array<Array<string>>} [list] 콘텐츠 리스트
 * @property {string} [image] 콘텐츠 이미지 url
*/
/**
카카오링크 리스트 수신 함수
 * @param {string} room 수신할 방 이름
 * @param {ListParameter} body 수신 인자
*/
const send = function (room, body) {
  const args = {};
  if(body.url) args.URL = body.url;
  if(body.title) args.TITLE = body.title;
  if(body.list) for(let i = 0; i < body.list.length; i++) {
    args["LIST"+(i+1)] = body.list[i][0];
    args["DESC"+(i+1)] = body.list[i][1];
  }
  if(body.image) args.IMG = body.image;
  Kakao.send(room, {
      link_ver: '4.0',
      template_id: 65868,
      template_args: args
  }, 'custom');
}

/**
 * 
 * @param {Connection.Request} data - 요청 인자 
 * @returns {Connection.Response}
 */
const request = function (data) {
  let con = Jsoup.connect(data.url).ignoreContentType(true).ignoreHttpErrors(true).method(Connection.Method.GET);
  if(data.requestBody) con = con.requestBody(data.requestBody);
  if(data.data) con = con.data(data.data);
  if(data.header) con = con.headers(data.header);
  if(data.method) con = con.method(Connection.Method.valueOf(data.method));
  if(data.parser) con = con.parser(data.parser);
  if(data.proxy) con = con.proxy(data.proxy);
  if(data.timeout) con = con.timeout(data.timeout);
  if(data.cookies) con = con.cookies(data.cookies);
  if(data.userAgent) con = con.userAgent(data.userAgent);

  return con.execute();
}

const requestObj = function (data) {
  return JSON.parse(new java.lang.String(request(data).bodyAsBytes(), "UTF-8"));
}

//명령어 관리 클래스
const CommandManager = function () {
  this.commands = [];
}
const manager = new CommandManager();

/**
명령어 옵션 클래스
 * @param {string} name 인자 이름
 * @param {"string"|"int"|"float"} [type="string"] 인자 타입 
*/
const Option = function(name, type) {
  this.name = name;
  this.type = type||"string";
  this.optional = false;
  if(this.type != 'string' && this.type != 'int' && this.type != 'float') throw new Error("옵션 생성자의 type 인자는 string, int, float 중 하나여야만 합니다: "+this.type);
}
Option.prototype.typeValid = function(arg) {
  if(type === "string") return true;
  if(type === "int") return !arg.replace(/\d/g, "");
  return !arg.replace(/\d|[\d+\.\d+]/g, "");
}
Option.prototype.setOptional = function() {
  this.optional = true;
  return this;
}


/**
기본 명령어 클래스
 * @param {(msg: Message)=>boolean} trigger 기본 명령어 판단자
 * @param {(msg: Message)=>void} listener 명령어 리스너
 * @param {Array<string>} [prefix=['!']] 임의 접두사
*/
const Command = function(trigger, listener, prefix) {
  this.trigger = trigger;
  this.listener = listener;
  this.id = manager.commands.length;
  this.prefix = prefix ? Array.isArray(prefix) ? prefix : [prefix] : [globalPrefix];
}
Command.prototype.run = function(msg) {
  if(this.isValid(msg)) this.listener(msg);
}
Command.prototype.isValid = function(msg) {
   return this.prefix.some(p=>msg.content.startsWith(p))&&this.trigger(msg);
}
Command.prototype.addPrefix = function(prefix) {
  this.prefix.push(prefix);
  return this;
}

/**
더 쉬운 명령어 관리를 위한 기초 명령어 클래스
 * @param {string|Array<string>} names 명령어 이름들
 * @param {(msg: Message)=>void} listener 명령어 리스너
 * @param {Option|Array<Option>} [options] 명령어 인자
 * @param {RegExp|string} [saperator=/\s/] 메시지 구분자
*/
const BaseCommand = function(names, listener, options, saperator) {
  Command.call(this, ()=>true, listener);
  this.names = Array.isArray(names) ? names : [names];
  this.options = options ? Array.isArray(options) ? options : [options] : [];
  this.saperator = typeof saperator === 'string' ? new RegExp(saperator) : saperator||new RegExp(' ');

  //옵션 유효성 검사
  let optional = false;
  for(let opt of this.options) {
    if(optional && !opt.optional) throw new Error("선택 매개변수는 필수 매개변수보다 앞에 있을 수 없습니다.");
    optional = opt.optional;
  }
}
BaseCommand.prototype = Object.create(Command.prototype);
BaseCommand.prototype.isValid = function(msg) { 
  if(Command.prototype.isValid.call(this, msg)) {
    const spliten = msg.content.split(/\s/);
    const args = msg.content.includes(this.saperator.toString().trip()) ? spliten.slice(1).join(" ").split(this.saperator) : spliten.slice(1);
    
    if(this.prefix.some(p=>this.names.includes(spliten[0].slice(p.length)))) {
      if(!this.options.length) return true;
      
      for(let i = 0; i < this.options.length; i++) {
        const opt = this.options[i];
        if(opt.optional || (args[i] && typeof args[i] === opt.type)) return true;
      }
      
      //유효하지 않은 서식은 도움말 답변
      if(this.options.length) msg.reply(this.prefix.join(",")+this.names.join("|")+" "+this.options.map(opt=>(opt.optional?"[":"(")+opt.name+":"+opt.type+(opt.optional?"]":")")).join(this.saperator.toString().trip()));
      else msg.reply(this.prefix.join(",")+this.names.join("|"));
    }
  }
}
BaseCommand.prototype.run = function(msg) {
  if(this.isValid(msg)) {
    const spliten = msg.content.split(/\s/);
    const args = msg.content.includes(this.saperator.toString().trip()) ? spliten.slice(1).join(" ").split(this.saperator) : spliten.slice(1);
    this.listener(msg, args);
  }
}
BaseCommand.prototype.addPrefix = function(prefix) {
  this.prefix.push(prefix);
  return this;
}


const help = function (msg) {
  msg.reply(manager.commands.map(cmd=>{
    let str = "• "+cmd.prefix.join(",")+cmd.names.join("|");
    if(cmd.options.length) str += " "+cmd.options.map(opt=>(opt.optional?"[":"(")+opt.name+":"+opt.type+(opt.optional?"]":")")).join(cmd.saperator.toString().trip());
    return str;
  }).join("\n"));
}

const roomInfo = function (msg) {
  const data = requestObj({
    url: "https://api.develope.kr/search/room",
    data: {
      room: msg.room
    }
  });
  if(data.success&&data.result) {
    let obj = data.result;
    send(msg.room, {
      url: "kakaoopen://join?l="+obj.link.split("/o/")[1]+"&r=EW",
      title: obj.name,
      list: [
        ["초대링크", obj.link],
        ["유저 수", obj.headcount+"명 ("+obj.like+"❤)"],
        ["관리자", obj.master]
      ]
    });
  } else {
    msg.reply("api 요청 실패: "+data.reason+"\n"+msg.content.split(" ").slice(1).join(" "));
  }
}

const disaster = function (msg, args) {
  const end = new Date();
  const start = new Date(end - (7 * 24 * 60 * 60 * 1000));
  const req = JSON.stringify({
    searchInfo:{
        recordCountPerPage: "10",
        searchBgnDe: start.getFullYear()+"-"+(start.getMonth()+1)+"-"+start.getDate(),
        searchEndDe: end.getFullYear()+"-"+(end.getMonth()+1)+"-"+end.getDate()
    }
  });
  const data = requestObj({
    url: "https://www.safekorea.go.kr/idsiSFK/sfk/cs/sua/web/DisasterSmsList.do",
    requestBody: req,
    method: 'POST',
    header: {
      'Content-Type': 'application/json;charset=utf-8'
    }
  });
  msg.reply(data.disasterSmsList.filter(e=>!args[0]||e.RCV_AREA_NM.includes(args[0])).map((sms,i,arr)=>
    sms.DSSTR_SE_NM+" | "+sms.CREAT_DT
    +"\n"+ sms.MSG_CN
    +(i==1&&arr.length>3?"\n\n 더 많은 검색결과 보기"+"\u200d".repeat(501):"")
  ).join("\n\n\n"));
}

const teach = function (msg, args) {
  const room = "study-"+msg.room.slice(0, 6).trim().toLowerCase().replace(reg, "").replace(/\s/g,"")+msg.room.length;
  const list = Database.exists(room+".json") ? JSON.parse(Database.readString(room+".json")) : {};
  const [ key, value ] = args;
  const exist = list[key];

  if(!value) {
    msg.reply(`기존 학습을 제거했습니다.\n${key}: X`);
    delete list[key];
  }
  else {
    if(exist) {
      msg.reply(`경고! 이미 존재하던 학습을 덮어씌웠습니다.\n${key}: ${exist.value} => ${value}`);
      exist.sender = msg.author.name;
      exist.value = value;
    }
    else {
      msg.reply(`새 학습을 가르쳤습니다.\n${key}: ${value}`);
      list[key] = {
        sender: msg.author.name,
        value: value
      }
    }
  }
  Database.writeString(room+".json", JSON.stringify(list));
}

const teachList = function (msg, args) {
  const room = "study-"+msg.room.slice(0, 6).trim().toLowerCase().replace(reg, "").replace(/\s/g,"")+msg.room.length;
  const list = Database.exists(room+".json") ? JSON.parse(Database.readString(room+".json")) : {};
  const [ sender ] = args;
  const keys = sender ? Object.keys(list).filter(k=>list[k].sender==sender) : Object.keys(list);
  const getData = s => s.map(k=>`  • ${k}: ${list[k].value} by ${list[k].sender}`).join("\n");
  msg.reply(`학습 리스트`+(sender?" by "+sender:"")+`\n==========\nroom: ${msg.room}\ntotal: ${keys.length}\nlist:\n`+(keys.length > 5 
  ? `${getData(keys.slice(0, 5))}\n\n전체 목록 보기\n${'\u200d'.repeat(501)}\n${getData(keys.slice(5))}`
  : `${getData(keys)}`))
}

const status = function (msg) {
  let str = "봇 상태";
  str += `\n• 기기 베터리: ${Device.getBatteryLevel()}%`;
  if(Device.isCharging()) str+=" (충전 중)";
  
  msg.reply(str);
}

const chatlog = function (msg, args) {
  const room = msg.room.slice(0, 6).trim().toLowerCase().replace(reg, "").replace(/\s/g,"")+msg.room.length;
  let filterstr = [];
  let reverse = true, viewDate = false, viewPre = false, sendImg = false, viewid = false;
  /** @type {Array<(cons: Array<string>)=>void>} */
  const listeners = [];

  /** @type {Array<(msg: Message)=>boolean>} */
  const filters = args[0] ? args[0].split(",").map(filter=>{
    const spliten = filter.split(":");
    const key = spliten[0].trim(), value = spliten.slice(1).join(":").trim();
    switch(key.toLowerCase()) {
      case 'sender': {
        if(value[0]=='/' && value[value.length-1]=='/') {
          filterstr.push(`${value}에 적합한 이름을 가진 유저가 보낸 메시지`);
          return (chat) => new RegExp(value.trip()).test(chat.sender);
        }
        filterstr.push(`${value} 이름을 가진 유저가 보낸 메시지`);
        return (chat) => chat.sender.includes(value);
      }
case 'id': {
        filterstr.push(`${value} ID인 유저가 보낸 메시지`);
        return (chat) => chat.senderID == value;
      }
      case 'msg': {
        if(value[0]=='/' && value[value.length-1]=='/') {
          filterstr.push(`${value}에 적합한 내용을 포함한 메시지`);
          return (chat) => new RegExp(value.trip()).test(chat.content);
        }
        filterstr.push(`${value} 내용을 포함한 메시지`);
        return (chat) => chat.content.includes(value);
      }
      case 'amount': {
        const val = parseInt(value.replace(/\D/g, ""));
        filterstr.push(`최근 ${val}개의 메시지`);
        listeners.push(cons=>cons.splice(0,cons.length-val));
        break;
      }
      case 'viewid': {
        filterstr.push("유저ID보기");
        viewid = true;
        break;
      }
      case 'reverse': {
        filterstr.push("정순으로");
        reverse = false;
        break;
      }
      case 'viewdate': {
        filterstr.push("날짜보기");
        viewDate = true;
        break;
      }
      case 'preview': {
        filterstr.push("미리보기");
        viewPre = true;
        break;
      }
      case 'image': {
        filterstr.push("최근 이미지");
        sendImg = true;
        break;
      }
    }
  }) : [];
  const chats = Database.readObject("chat-"+room+".json");
   
  /** @type {Array<string>} */
  const contents = chats.map(data=>{
    const date = new Date(data.timeline);
    if(!filters.length||filters.every(filter=>filter?filter(data):true)) return (viewid?`\n##${data.senderID}##\n`:"")+(viewDate ? `[${date.getMonth()}/${date.getDate()} ${(date.getHours() > 12 ? '오후 ' + (date.getHours()-12) : '오전 ' + date.getHours())}:${date.getMinutes()}:${date.getSeconds()}] ` : "")+`${data.sender}: ${data.content}\n`;
    return "";
  }).filter(e=>e);
  listeners.forEach(listener=>listener(contents));
  if(reverse) contents.reverse();

  const head = `총 ${contents.length}개\n`+(filterstr.length ? `필터: \n• ${filterstr.join("\n• ")}\n` : "")+"\n";
  if(contents.length > 5) {
    const [preview, all] = contents.splitIndex(5);
    if(viewPre) msg.reply(head+preview.join('')+`more${'\u200d'.repeat(501)}\n`+all.join(''))
    else msg.reply(head+`more${'\u200d'.repeat(501)}\n`+contents.join(''));
  }
  else msg.reply(head+contents.join(''));

  const image = chats.reverse().find(c=>c.image);
  if(sendImg) {
    if(!image) return msg.reply("이미지가 없습니다!");
    const url = `https://res.CLOUDINARY_CLIENT_ID.com/${CLOUDINARY_CLIENT_ID}/image/upload/`+image.id;
    
    send(msg.room, {
      url: url,
      image: url,
      title: "최근 이미지"
    });
  }
}

const corona = function (msg) {
  const vaccinate = [];
  const vac = request({
    url: "http://ncov.mohw.go.kr/"
  }).parse();
  const child = vac.select("div.child_list").select("percent").toArray();
  let i = 0;
  vac.select("div.vaccine_list > div.inner.cl_b_aftr > div.box").forEach(ele => {
    const percent = ele.select("li.percent").first();
    const [total, today, six] = ele.select("li.person").toArray();
    vaccinate.push(`${(i+1)}차 접종: +${today.ownText()}명 (누적 ${total.ownText()}명 - ${percent.ownText()}%${(child[i] ? `, 청소년: ${child[i].ownText()}%` : "")}${(six ? `, 60세 이상: ${six.ownText()}` : "")})`);
    i++;
  });

  const [dayDead, , , dayConfirm] = vac.select("table.ds_table").select("td > span").toArray();
  const [totalDead, totalConfirm] = vac.select("div.occur_num > div.box").toArray();
  msg.reply(`백신 현황\n==========\n${vaccinate.join("\n")}\n\n확진/사망 현황\n==========\n확진: +${dayConfirm.ownText()}명 (누적 ${totalConfirm.ownText()}명)\n사망: +${dayDead.ownText()}명 (누적 ${totalDead.ownText()}명)`);
}

const onMessage = function (msg) {
  const cont = msg.content;
  const room = msg.room;
  if(cont.includes("라그랑주")) {
    send(room, {title: "클릭!", url: "kakao://launch?pkgnames=[com.netease.lagrange]"});
  }
  else if(cont.startsWith("메인")) {
    send(room, {title: "클릭!", url: "kakaoopen://main"});
  }
  else if(cont.startsWith("선물하기")) {
    send(room, {title: "클릭!", url: "kakaotalk://gift/home?go_giftbox=inbox"});
  }
  else if(cont.startsWith("카드")) {
    send(room, {title: "클릭!", url: "kakaoopen://card/create"});
  }
  else if(cont.startsWith("프로필")) {
    send(room, {title: "클릭!", url: "kakaotalk://miniprofile/me"});
  }
  else if(cont.startsWith("상점")) {
    send(room, {title: "클릭!", url: "kakaotalk://store"});
  }
  else if(cont.startsWith("캘린더")) {
    send(room, {title: "클릭!", url: "kakaotalk://calendar"});
  }
  else if(cont.startsWith("카카오페이")) {
    send(room, {title: "클릭!", url: "kakaotalk://kakaopay/home"});
  }
  else if(cont.startsWith("구매")) {
    send(room, {title: "클릭!", url: "kakaotalk://buy"});
  }
  else if(cont.startsWith("실행")) {
    send(room, {title: "클릭!", url: "kakao://launch?pkgnames=["+pkgname+"]"});
  }
  else if(cont.startsWith("몰?루")) {
    const molu = [
      ["모?루", `https://res.cloudinary.com/${CLOUDINARY_CLIENT_ID}/image/upload/v1637820695/1637601279492_cugxuz.jpg`],
      ["쇼핑몰?루", `https://res.cloudinary.com/${CLOUDINARY_CLIENT_ID}/image/upload/v1637874000/1637873933719_fxvncd.jpg`],
      ["뿅!", `https://res.cloudinary.com/${CLOUDINARY_CLIENT_ID}/image/upload/v1637874683/images_1_qzx3hm.jpg`],
      ["몰?루없음", `https://res.cloudinary.com/${CLOUDINARY_CLIENT_ID}/image/upload/v1637874661/images_bntlm7.jpg`],
      ["모모?코", `https://res.cloudinary.com/${CLOUDINARY_CLIENT_ID}/image/upload/v1637874697/i14615767089_r4plwp.png`]
    ];
    const rand = (Math.random()*4).toFixed();
    
    Kakao.send(room, {
      link_ver: '4.0',
      template_id: 65868,
      template_args: {
        "IMG1": `https://res.cloudinary.com/${CLOUDINARY_CLIENT_ID}/image/upload/v1637819645/1637601286501_revroy.jpg`,
        "TITLE": "몰?루",
        "CAT1": "몰루???",
        "ITEM": molu[Math.min(4,rand)][0],
        "ITEMIMG": molu[Math.min(4,rand)][1]
      }
    }, 'custom');
  }
}

const daum = function (search, page) {
  const obj = {};
  const list = JSON.parse(
    new java.lang.String(Jsoup.connect("https://dapi.kakao.com/v2/search/web")
      .data("query", search)
      .header("Authorization", "KakaoAK "+NAVER_KEY) 
      .ignoreContentType(true)
      .ignoreHttpErrors(true) 
      .execute().bodyAsBytes(), "UTF-8")).documents;
  
  obj["TITLE"] = "Daum web search: "+search+" ("+(page+1)+"/"+(list.length/5).toFixed()+")";
  list.slice(5*page, 5*(page+1)).forEach((l,i)=>{
    obj["LIST"+(i+1)] = (l.title||"").replace(/[<b>|</b>]/g,"");
    obj["DESC"+(i+1)] = (l.contents||"").replace(/<b>|<\/b>/g,"");
    obj["LINK"+(i+1)] = "redirect?url="+l.url;
  });
  return obj;
}

const melon = function (search, page) {
  const obj = {};
  const list = requestObj({
    url: "https://api.music.msub.kr",
    data: {
      song: search
    }
  }).song;
  
  obj["TITLE"] = "Melon song search: "+search+" ("+(page+1)+"/"+(list.length/5).toFixed()+")";
  list.slice(5*page, 5*(page+1)).forEach((l,i)=>{
    obj["LIST"+(i+1)] = l.name;
    obj["DESC"+(i+1)] = l.artist+" | "+l.album;
    obj["IMG"+(i+1)] = l.albumimg;
    obj["LINK"+(i+1)] = "redirect?url="+l.kakaomelonlink;
  });
  return obj;
}

const openchat = function (search, page) {
  const obj = {};
  const list = requestObj({
    url: "https://api.develope.kr/search/room/list",
    data: {
      type: "m",
      query: search
    }
  }).result.lists;
 
  obj["TITLE"] = (search.length<=9?"Kakao room search: "+search:search)+" ("+(page+1)+"/"+(list.length/5).toFixed()+")";
  list.slice(5*page, 5*(page+1)).sort((a,b)=>a.headcount<b.headcount?1:-1).forEach((l,i)=>{
    obj["LIST"+(i+1)] = l.name;
    obj["DESC"+(i+1)] = l.headcount+"명 | "+l.like+"❤";
    obj["IMG"+(i+1)] = l.wp;
    obj["LINK"+(i+1)] = "redirect?url="+l.openlink;
  });
  return obj;
}

const androidapp = function (search, page) {
  const obj = {};
  const list = requestObj({
    url: "https://data.42matters.com/api/v2.0/android/apps/search.json",
    data: {
      access_token: MATTERS_KEY,
      q: search
    }
  }).results;

  obj["TITLE"] = (search.length<=8?"Android app search: "+search:search)+" ("+(page+1)+"/"+(list.length/5).toFixed()+")";
  list.slice(5*page, 5*(page+1)).forEach((l,i)=>{
    obj["LIST"+(i+1)] = l.title + " | "+ l.rating.toFixed(1)+"★";
    obj["DESC"+(i+1)] = l.downloads +" 다운로드 | "
      + (l.iap?"인앱결제 | ":"") 
      + (l.contain_ads?"광고포함 | ":"");
    obj["IMG"+(i+1)] = l.icon;
    obj["LINK"+(i+1)] = "redirect?url="+l.market_url;
  });
  return obj;
}

const youtube = function (search, page, type) {
  const obj = {};
  const list = requestObj({
    url: "https://www.googleapis.com/youtube/v3/search",
    data: {
      key: GOOGLE_KEY,
      part: "snippet",
      q: search,
      type: type||"video"
    }
  }).items;
  
  obj["TITLE"] = "Youtube "+(type||"video")+" search: "+search+" ("+(page+1)+"/"+(list.length/5).toFixed()+")";
  list.slice(5*page, 5*(page+1)).forEach((l,i)=>{
    obj["LIST"+(i+1)] = l.snippet.title;
    obj["DESC"+(i+1)] = l.snippet.publishTime.slice(0,10) + " | " + l.snippet.description;
    obj["IMG"+(i+1)] = l.snippet.thumbnails.high.url;
    obj["LINK"+(i+1)] = "redirect?url=https://youtube.com/video/"+l.id.videoId;
  });
  return obj;
}

const naverencyc = function (search) {
  const list = requestObj({
    url: "https://openapi.naver.com/v1/search/encyc.json",
    data: {
      query: search,
      display: "10",
      sort: "sim"
    },
    header: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET
    }
  }).items;

  return "Naver encyc search: "+search+"\n\n\n"+list.map((e,i)=>
     e.title.replace(/<b>|<\/b>/g, "")
       +"\n"+e.description.replace(/<b>|<\/b>|\\n/g, "")
       +"\n자세히 보기: "+e.link
       +(i==0&&list.length>2?"\n\n 더 많은 검색결과 보기"+"\u200d".repeat(501):"")).join("\n\n");
}

const google = function (search, page) {
  const obj = {};
  const list = requestObj({
    url: "https://customsearch.googleapis.com/customsearch/v1",
    data: {
      key: GOOGLE_KEY,
      cx: SEARCH_ID,
      q: search,
      gl: "KR",
      hl: "KO",
      lr: "lang_ko"
    }
  }).items;
    
  obj["TITLE"] = "Google web search: "+search+" ("+(page+1)+"/"+(list.length/5).toFixed()+")";
  list.slice(5*page, 5*(page+1)).forEach((l,i)=>{
    obj["LIST"+(i+1)] = l.title;
    obj["DESC"+(i+1)] = l.snippet;
    obj["IMG"+(i+1)] = l.pagemap.cse_image[0].src;
    obj["LINK"+(i+1)] = "redirect?url="+l.link;
  });
  return obj;
}

const github = function (search, page, options) {
  let gitype = (options.find(e=>e.startsWith("t:"))||"t:repo").slice(2);
  gitype = gitype=="topic"?"topics":gitype=="user"?"users":"repositories";
  let sort = (options.find(e=>e.startsWith("s:"))||"s:star").slice(2);

  const httpreq = url => requestObj({
    url: url,
    header: {
      "Authorization": java.lang.String("token "+GITHUB_KEY)
    }
  });

  let v = httpreq("https://api.github.com/search/"+(gitype||"repositories")+"?q="+search);
  let list = v.items;
  
  if(gitype=="users") list = httpreq(list.shift().repos_url);
  if(sort=="star") list = list.sort((r1,r2)=>parseInt(r1.stargazers_count)<parseInt(r2.stargazers_count)?1:-1);
  
  return "Github "+(gitype||"repo")+" search: "+search+" ("+(page+1)+"/"+(Math.max(1,list.length/5)).toFixed()+")\n\n"+
  list.slice(5*page, 5*(page+1)).map((r,i)=>{
   let langs = httpreq(r.languages_url);
   let total = Object.keys(langs).length&&Object.keys(langs).map(k=>langs[k]).reduce((a,e)=>a+e);
   let tags = [];
   if(r.archive) tags.push("읽기 전용");
   if(r.disabled) tags.push("비활성화");
   if(r.allow_forking) tags.push("복제 가능");
   if(r.fork) tags.push("복제본");
   if(r.private) tags.push("비공개");
   if(r.is_template) tags.push("템플릿");
   
   return r.full_name
    +"\n• 기본 정보: "
      +r.forks+" 포크 | "
      +r.open_issues_count+" 이슈 | "
      +r.stargazers_count+" 스타 | "
      +httpreq(r.subscribers_url).length+" 구독자 | "
      +httpreq(r.contributors_url).length+" 기여자"
    +(tags.length?"\n• 유형: "+tags.join(" | "):"")
    +(r.topics.length?"\n• 토픽: "+r.topics.map(e=>"#"+e).join(" | "):"")
    +(total?"\n• 언어 구성: "+Object.keys(langs).map((k)=>k+": "+(langs[k]/total*100).toFixed(2)+"%").join(" | "):"")
    +(r.license?"\n• 라이선스: "+r.license.spdx_id:"")
    +"\nby "+r.owner.login
    +"\n"+(r.description||"")
    +(i==0&&list.length>1?"\n\n 더 많은 검색결과 보기"+"\u200d".repeat(501):"");
  }).join("\n\n\n");
}

const search = function (msg, args) {
  let [ type, search, options ] = args;
  let option = options&&options.replace(/\s/g,"").split(",");
  let page = option?parseInt((option.find(e=>e.startsWith("p:"))||"p:1").slice(2))-1:0;
  let obj = {};
  
  switch(type) {
    case "유튜브": 
      obj = youtube(search, page);
      break;
    case "멜론":
      obj = melon(search, page);
      break;
    case "다음":
      obj = daum(search, page);
      break;
    case "사전": 
      obj = naverencyc(search);
      break;
    case "구글": 
      obj = google(search, page);
      break;
    case "플스": 
      obj = androidapp(search, page);
      break;
    case "카톡":
      obj = openchat(search, page);
      break;
    case "깃허브": 
      obj = github(search, page, option);
      break;
    default: msg.reply("Invalid type!");
  }
  
  if(typeof obj === "object")
    Kakao.send(msg.room, {
      link_ver: "4.0",
      template_id: 65892,
      template_args: obj
    }, 'custom');
  else if(typeof obj === "string") 
    msg.reply(obj);
  else msg.reply("Empty object!");
}

init();

bot.addListener(Event.MESSAGE, msg=>{
  android.os.StrictMode.enableDefaults();
  manager.commands.forEach(cmd => cmd.run(msg));
  onMessage(msg);

  //가르치기 확인
  const room = msg.room.slice(0, 6).trim().toLowerCase().replace(reg, "").replace(/\s/g,"")+msg.room.length;
  if (Database.exists("study-"+room+".json")) {
    const chat = JSON.parse(Database.readString("study-"+room+".json"))[msg.content.trim()];
    if(chat) msg.reply(chat.value);
  }

  

  //사진 클라우드 저장
  if(false&&msg.content == "사진을 보냈습니다.") {
    const imagename = "test"+Date.now();
    const base64 = 'data:image/png;base64,'+msg.image.getBase64();
    org.jsoup.Jsoup.connect(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLIENT_ID}/image/upload`) 
      .data('file', base64) 
      .data('upload_preset','kakaoupload') 
      .data('public_id', imagename) 
      .ignoreContentType(true).ignoreHttpErrors(true).post().text();
  }
});


function onNotificationPosted(sbn, sm) { 
  let packageName = sbn.getPackageName();
  if (!packageName.startsWith("com.kakao.tal")) return;
   Log.info(sbn.getNotification().extras);
  const sbns = sbn.getNotification().extras;
   if(!sbns.get("android.subText")||!sbns.get("android.messages")) return;
  const msg = sbns.get("android.messages")[0];
  const room = sbns. get("android.subText").slice(0, 6).trim().toLowerCase().replace(reg, "").replace(/\s/g,"")+sbns. get("android.subText").length;
  //대화기록 수집
  const hash = java.lang.String(msg.get("sender_person").getKey()).hashCode();
  const data = {
    senderID: hash,
    sender: msg.get("sender_person").getName().replace(/\u202e/g,""),
    content: msg.get("text").replace(/\u202e/g,""),
    timeline: msg.get("time")
  };
  const chats = Database.exists("chat-"+room+".json") ? Database.readObject("chat-"+room+".json") : [];
  chats.push(data);
  Database.writeString("chat-"+room+".json", JSON.stringify(chats));

 if(msg.get("text").startsWith("do")){
    if(perms.includes(hash)){
      try {
        const result = eval(msg.get("text").slice(2));
        if(!String(result)) Api.replyRoom(sbns.get("android.subText"),"[eval] 결과값이 \"\"입니다.");
        else Api.replyRoom(sbns.get("android.subText"),result);
      } catch(e) {
        Api.replyRoom(sbns.get("android.subText"),e);
      }
    }
    else Api.replyRoom(sbns.get("android.subText"), "권한 미달: "+hash);
  }
}
