const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
require('dotenv').config();

const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const {sequelize} = require('./models');
const passportConfig = require('./passport');

// 서버센트 이벤트를 사용해서 서버의 시간을 받아온다.
// 주기적으로 서버 시간을 조회하는 데는 양방향 통신이 필요하지 않다.
// 서버센트 이벤트와 웹 소켓은 같이 사용할 수 있다.
const sse = require('./sse');
const webSocket = require('./socket');
// checkAuction을 서버에 연결한다.
const checkAuction = require('./checkAuction');

const app = express();

sequelize.sync();
passportConfig(passport);
checkAuction();

const sessionMiddleware = session({
    resave : false,
    saveUninitialized : false,
    secret : process.env.COOKIE_SECRET,
    cookie : {
        httpOnly : true,
        secure : false,
    },
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', process.env.PORT || 8010);

app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(express.urlencoded({extended : false}));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use('/', indexRouter);
app.use('/auth', authRouter);

app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use((err, req, res) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.render('error');
});

const server = app.listen(app.get('port'), () => {
    console.log(app.get('port'), '번 포트에서 대기 중!');
});

// 서버와 sse, socket.io 모듈을 연결한다.
webSocket(server, app);
sse(server);