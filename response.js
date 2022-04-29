importPackage(org.jsoup);

const bot = BotManager.getCurrentBot();
const manager = new CommandManager();
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
const perm = ['-472599725'];


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
    new BaseCommand(["do", "eval"], executeEval).addPrefix(""),
    new BaseCommand("방정보", roomInfo),
    new BaseCommand("재난", disaster, new Option("지역").setOptional()),
    new BaseCommand(["가르치기", "sd"], teach, [new Option("키"), new Option("값")], "::"),
    new BaseCommand(["가르친것", "sdl"], teachList, new Option("만든이").setOptional()),
    new BaseCommand(["상태확인", "status"], status),
    new BaseCommand(["대화기록", "cl"], chatlog, new Option("필터").setOptional()),
    new BaseCommand(["코로나", "corona"], corona),
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
function send(room, body) {
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

//명령어 관리 클래스
function CommandManager() {
  this.commands = [];
}

/**
명령어 옵션 클래스
 * @param {string} name 인자 이름
 * @param {"string"|"int"|"float"} [type="string"] 인자 타입 
*/
const Option = function(name, type) {
  this.name = name;
  this.type = type||"string";
  this.optional = false;
  this.typeValid = arg => {
    if(type === "string") return true;
    if(type === "int") return !arg.replace(/\d/g, "");
    return !arg.replace(/\d|[\d+\.\d+]/g, "");
  }
  this.setOptional = function() {
    this.optional = true;
    return this;
  }

  if(this.type != 'string' && this.type != 'int' && this.type != 'float') throw new Error("옵션 생성자의 type 인자는 string, int, float 중 하나여야만 합니다: "+this.type);
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
      let str = this.prefix.join(",")+this.names.join("|");
      if(this.options.length) str += " "+this.options.map(opt=>(opt.optional?"[":"(")+opt.name+":"+opt.type+(opt.optional?"]":")")).join(this.saperator.toString().trip());
      msg.reply(str);
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


function help(msg) {
  msg.reply(manager.commands.map(cmd=>{
    let str = "• "+cmd.prefix.join(",")+cmd.names.join("|");
    if(cmd.options.length) str += " "+cmd.options.map(opt=>(opt.optional?"[":"(")+opt.name+":"+opt.type+(opt.optional?"]":")")).join(cmd.saperator.toString().trip());
    return str;
  }).join("\n"));
}

function roomInfo(msg) {
  const data = JSON.parse(Jsoup.connect("https://api.develope.kr/search/room?room="+msg.room)
    .ignoreContentType(true)
    .ignoreHttpErrors(true)
    .get().text());
  
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

function disaster(msg, args) {
  const end = new Date();
  const start = new Date(end - (7 * 24 * 60 * 60 * 1000));
  const req = JSON.stringify({
    searchInfo:{
        recordCountPerPage: "10",
        searchBgnDe: start.getFullYear()+"-"+(start.getMonth()+1)+"-"+start.getDate(),
        searchEndDe: end.getFullYear()+"-"+(end.getMonth()+1)+"-"+end.getDate()
    }
  });
  const data = JSON.parse(Jsoup.connect('https://www.safekorea.go.kr/idsiSFK/sfk/cs/sua/web/DisasterSmsList.do') 
    .header('Content-Type', 'application/json;charset=utf-8')
    .requestBody(req)
    .ignoreContentType(true)
    .ignoreHttpErrors(true)
    .post().text());
  msg.reply(data.disasterSmsList.filter(e=>!args[0]||e.RCV_AREA_NM.includes(args[0])).map((sms,i,arr)=>
    sms.DSSTR_SE_NM+" | "+sms.CREAT_DT
    +"\n"+ sms.MSG_CN
    +(i==1&&arr.length>3?"\n\n 더 많은 검색결과 보기"+"\u200d".repeat(501):"")
  ).join("\n\n\n"));
}

function teach(msg, args) {
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

function teachList(msg, args) {
  const room = "study-"+msg.room.slice(0, 6).trim().toLowerCase().replace(reg, "").replace(/\s/g,"")+msg.room.length;
  const list = Database.exists(room+".json") ? JSON.parse(Database.readString(room+".json")) : {};
  const [ sender ] = args;
  const keys = sender ? Object.keys(list).filter(k=>list[k].sender==sender) : Object.keys(list);
  const getData = s => s.map(k=>`  • ${k}: ${list[k].value} by ${list[k].sender}`).join("\n");
  msg.reply(`학습 리스트`+(sender?" by "+sender:"")+`\n==========\nroom: ${msg.room}\ntotal: ${keys.length}\nlist:\n`+(keys.length > 5 
  ? `${getData(keys.slice(0, 5))}\n\n전체 목록 보기\n${'\u200d'.repeat(501)}\n${getData(keys.slice(5))}`
  : `${getData(keys)}`))
}

function status(msg) {
  let str = "봇 상태";
  str += `\n• 기기 베터리: ${Device.getBatteryLevel()}%`;
  if(Device.isCharging()) str+=" (충전 중)";
  
  msg.reply(str);
}

function chatlog(msg, args) {
  const room = msg.room.slice(0, 6).trim().toLowerCase().replace(reg, "").replace(/\s/g,"")+msg.room.length;
  let filterstr = [];
  let reverse = true, viewDate = false, viewPre = false, sendImg = false;
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
        listeners.push(cons=>cons=cons.slice(cons.length-1-val, cons.length-1));
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
    if(!filters.length||filters.every(filter=>filter?filter(data):true)) return (viewDate ? `[${date.getMonth()}/${date.getDate()} ${(date.getHours() > 12 ? '오후 ' + (date.getHours()-12) : '오전 ' + date.getHours())}:${date.getMinutes()}:${date.getSeconds()}] ` : "")+`${data.sender}: ${data.content}\n`;
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
    const url = `https://res.cloudinary.com/${secret.cloudinary}/image/upload/`+image.id;
    
    send(msg.room, {
      url: url,
      image: url,
      title: "최근 이미지"
    });
  }
}

function executeEval(msg) {  
  const userhash = java.lang.String(msg.author.avatar.getBase64()).hashCode();
  if(perm.includes(""+userhash)){
    try {
      const result = eval(msg.content.split(/\s/).slice(1).join(" "));
      if(!String(result)) msg.reply("[eval] 결과값이 \"\"입니다.");
      else msg.reply(result);
    } catch(e) {
      msg.reply(e);
    }
  }
  else msg.reply("권한 미달: "+userhash);
}

function corona(msg) {
  const vaccinate = [];
  const vac = Jsoup.connect("http://ncov.mohw.go.kr/").get().body();
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

function onMessage(msg) {
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
      ["모?루", `https://res.cloudinary.com/${secret.cloudinary}/image/upload/v1637820695/1637601279492_cugxuz.jpg`],
      ["쇼핑몰?루", `https://res.cloudinary.com/${secret.cloudinary}/image/upload/v1637874000/1637873933719_fxvncd.jpg`],
      ["뿅!", `https://res.cloudinary.com/${secret.cloudinary}/image/upload/v1637874683/images_1_qzx3hm.jpg`],
      ["몰?루없음", `https://res.cloudinary.com/${secret.cloudinary}/image/upload/v1637874661/images_bntlm7.jpg`],
      ["모모?코", `https://res.cloudinary.com/${secret.cloudinary}/image/upload/v1637874697/i14615767089_r4plwp.png`]
    ];
    const rand = (Math.random()*4).toFixed();
    
    Kakao.send(room, {
      link_ver: '4.0',
      template_id: 65868,
      template_args: {
        "IMG1": `https://res.cloudinary.com/${secret.cloudinary}/image/upload/v1637819645/1637601286501_revroy.jpg`,
        "TITLE": "몰?루",
        "CAT1": "몰루???",
        "ITEM": molu[Math.min(4,rand)][0],
        "ITEMIMG": molu[Math.min(4,rand)][1]
      }
    }, 'custom');
  }
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

  const data = {
    content: msg.content,
    sender: msg.author.name,
    timeline: Date.now()
  };

  //사진 클라우드 저장
  if(msg.content == "사진을 보냈습니다.") {
    const imagename = "test"+Date.now();
    const base64 = 'data:image/png;base64,'+msg.image.getBase64();
    org.jsoup.Jsoup.connect(`https://api.cloudinary.com/v1_1/${secret.cloudinary}/image/upload`) 
      .data('file', base64) 
      .data('upload_preset','kakaoupload') 
      .data('public_id', imagename) 
      .ignoreContentType(true).ignoreHttpErrors(true).post().text();

    data.image = {
      id: imagename,
      code: base64
    }
  }

  //대화기록 수집
  const chats = Database.exists("chat-"+room+".json") ? Database.readObject("chat-"+room+".json") : [];
  chats.push(data);
  Database.writeString("chat-"+room+".json", JSON.stringify(chats));
});