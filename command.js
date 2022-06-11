(function() {
  const globalPrefix = '!';

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
  module.exports = {
    Option: Option,
    Command: Command,
    BaseCommand: BaseCommand,
    manager: manager
  };
})();
