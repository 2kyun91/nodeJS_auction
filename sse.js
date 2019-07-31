/**
 * SSE 모듈을 불러와 new SSE(익스프레스 서버)로 서버 객체를 생성한다.
 * connection 이벤트 리스너로 클라이언트와 연결 시 동작할 기능을 정의한다.
 * 라우터에서 SSE를 사용하려면 app.set 메소드로 client 객체를 등록하고 req.app.get 메소드로 가져온다.
 * 
 * 서버센트 이벤트는 익스플로러나 엣지 브라우저에서 EventSource 객체를 지원하지 않기 때문에 사용할 수 없는 단점이 있다.
 * 이를 해결하기 위해 EventSource를 사용자가 직접 구현한다.
 * 클라이언트 코드에 EventSource polyfill을 넣어준다.(main.pug)
 */
const SSE = require('sse');

module.exports = (server) => {
    const sse = new SSE(server);
    sse.on('connection', (client) => {
        setInterval(() => {
            client.send(new Date().valueOf().toString());
        }, 1000);
    });
};