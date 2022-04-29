# KakaoBot
채팅 자동응답 봇 어플리케이션을 이용한 Rhino Javascript 기반 카카오톡 봇 스크립트


## 적용하는 방법
* 채팅 자동응답 봇을 설치한 후, 새 자바스크립트 봇을 생성한 다음 `response.js`의 내용을 가져다쓰고 리로드하여 활성화합니다.


## 알아야 할 것
* 이 스크립트는 봇의 완벽한 구동을 관장하지 않습니다. **기초적인 봇 구동 환경이 갖추어져야 합니다.** 
* 이 스크립트는 타인이 사용할 것을 가정하고 설계된 범용적인 스크립트가 아닙니다.
* 이 스크립트는 Rhino Javascript를 기반으로 구성되었기에 일부 ES6 문법을 사용할 수 없으며, 대신 일부 자바 패키지를 사용할 수 있습니다.
* 이 스크립트는 `secret.json`이라는 특정 JSON파일과 `kaling.js`, `crypto.js` 스크립트가 선택적으로 요구됩니다.

### 카카오링크
카카오링크 관련 기능을 사용하기 위해선 `sdcard/ChatBot/database/secret.json`과 특정 모듈이 필요합니다. 

#### Secret.json
secret.json 파일은 카카오톡링크 정보 등 개인정보를 담은 파일입니다.
```
{
  "kakao": {
    "id": "로그인할 카카오톡 계정 아이디",
    "pw": "로그인할 카카오톡 계정 패스워드",
    "key": "사용 어플리케이션의 Javascript 키",
    "domain": "사용 어플리케이션의 웹 도메인"
  },
  "cloudinary": "cloudinary 아이디"
}
```
위 서식에 맞도록 파일을 작성하여 저장하면 됩니다.

#### Kaling.js
[카카오링크 가이드](https://darktornado.github.io/KakaoTalkBot/docs/kakaolink/kakaolink/)를 참고하세요.
