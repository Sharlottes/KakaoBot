# KakaoBot
채팅 자동응답 봇 어플리케이션을 이용한 Rhino Javascript 기반 카카오톡 봇 스크립트


## 적용하는 방법
1. 채팅 자동응답 봇을 설치한 후, 새 자바스크립트 봇을 생성한 다음 `response.js`를 추가합니다.
2. 아래 `command.js`를 경로에 맞게 추가합니다. 선택적으로, `secret.json`도 경로에 맞게 추가합니다.
3. 앱에서 리로드하여 활성화합니다.


## 알아야 할 것
* 이 스크립트는 봇의 완벽한 구동을 관장하지 않습니다. **기초적인 봇 구동 환경이 갖추어져야 합니다.** 
* 이 스크립트는 타인이 사용할 것을 가정하고 설계된 범용적인 프로젝트가 아닙니다.
* 이 스크립트는 Rhino Javascript를 기반으로 구성되었기에 일부 ES6 문법을 사용할 수 없으며, 일부 자바 패키지를 사용할 수 있습니다.
* 이 스크립트는 `secret.json`, `kaling.js`, `crypto.js`가 선택적으로 요구됩니다.
* 이 스크립트는 `command.js`가 **필수적**으로 요구됩니다.


## Command.js
`ChatBot/module/command.js`은 봇 구동에 필수적인 명령어 간편 구축 모듈입니다.

### Command
명령어 클래스. 여러 접두사를 지원합니다.

#### Constructor 
    (trigger: (msg: Message) => boolean, listener: (msg: Message) => void, prefix: string[] | string = ['!'])
#### Property
|    Name   |                Type             |                                   Description                  |
| :-------: | :-----------------------------: | :------------------------------------------------------------: |
| trigger   | `(msg: Message) => boolean`     | 명령어 이벤트 리스너 조건.                                      |
| listener  | `(msg: Message) => void`        | 명령어 이벤트 리스너.                                           |
| prefix    | `string[]`                      | 접두사 목록. 생성자에 단일 요소만 입력할 시 새 배열로 전환합니다. |
| id        | `number`                        | 명령어 고유 ID. 딱히 쓰이진 않습니다.                           |
| run       | `(msg: Message) => void`        | 인자로 받은 `Message`로 명령어를 실행합니다.                    |
| isValid   | `(msg: Message) => boolean`     | 인자로 받은 `Message`로 명령어가 유효한지 검사합니다.            |
| addPrefix | `(prefix: string) => Command`   | 인자로 받은 접두사를 추가합니다.                                |

### BaseCommand
명령어 이름과 인자가 추가된 기본 명령어 클래스. 여러 이름과 인자를 지원합니다.

#### Constructor 
    (names: string[] | string, listener: (msg: Message) => void, options: Option[] | Option, saperator: RegExp | string = /\s/)
#### Property
|    Name   |    Type    |           Description             |
| :-------: | :--------: | :-------------------------------: |
| names     | `string[]` | 명령어 이름 목록                   |
| options   | `Option[]` | 명령어 인자 목록                   |
| saperator | `RegExp`   | 명령어 인자 구분자. 기본값 띄워쓰기 |

### Option
`BaseCommand`의 명령어 인자 타입

#### Constructor 
    (name: string, type: 'string'|'int'|'float' = 'string')
#### Property
|    Name     |            Type            |                          Description                       |
| :---------: | :------------------------: | :--------------------------------------------------------: |
| name        | `string`                   | 옵션 이름                                                  |
| type        | `'string'\|'int'\|'float'`   | 옵션 타입                                                  |
| optional    | `boolean`                  | 참이면 옵션이 선택적입니다.                                 |
| typeValid   | `(arg: string) => boolean` | 인자로 받은 `arg`의 타입이 옵션 타입과 일치하는지 검사합니다. |
| setOptional | `() => Option`             | 옵션을 선택적으로 만듭니다.                                 | 


## Secret.json
`ChatBot/database/secret.json`은 봇 구동에 선택적으로 필요한 개인정보를 담은 파일입니다. 생략 시 해당 기능이 무시됩니다.

* `kakao` - [카카오링크](https://darktornado.github.io/KakaoTalkBot/docs/kakaolink/kakaolink) 사용
* `nodejs` - [remote-kakao](https://github.com/remote-kakao/core) 모듈로 Node.js 서버와 통신
* `api` - 검색 api key
```
{
  "kakao": {
    "id": "로그인할 카카오톡 계정 아이디",
    "pw": "로그인할 카카오톡 계정 패스워드",
    "key": "사용 어플리케이션의 Javascript 키",
    "domain": "사용 어플리케이션의 웹 도메인"
  },
  "nodejs": {
    "address": "연결할 Node.js 서버 IP",
    "port": "해당 서버에서 설정한 remote-kakao 포트"
  },
  "api": {
    "CLOUDINARY_CLIENT_ID": "cloudinary id",
    "GOOGLE_KEY": "google api key",
    "SEARCH_ID": "google search api id",
    "NAVER_KEY": "naver api key",
    "NAVER_CLIENT_ID": "naver client id",
    "NAVER_CLIENT_SECRET": "naver client secret key"
    "MATTERS_KEY": "matters 42 api key",
    "GITHUB_KEY": "github api key"
  }
}
```


## 할 것
- [*] jsoup 요청을 함수화하기  
- [ ] 종합검색 명령어 복구하기  
- [*] 선택적 매개변수 간 배치 변경을 자유롭게 하기  
