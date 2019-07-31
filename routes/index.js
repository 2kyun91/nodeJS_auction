const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');

const {Good, Auction, User, sequelize} = require('../models');
const {isLoggedIn, isNotLoggedIn} = require('./middlewares');

const router = express.Router();

// res.locals.user = req.user;로 모든 pug 템플릿에 사용자 정보를 변수로 집어 넣는다.
// 이렇게 하면 res.render 메소드에 user : req.user를 하지 않아도 되므로 중복을 제거할 수 있다.
router.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});

// 메인화면을 렌더링한다.
router.get('/', async (req, res, next) => {
    try {
        const goods = await Good.findAll({where : {soldId : null}});
        
        res.render('main', {
            title : 'NodeAuction',
            goods,
            loginError : req.flash('loginError'),
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// 회원가입 화면을 렌더링한다.
router.get('/join', isNotLoggedIn, (req, res) => {
    res.render('join', {
        title : '회원가입 - NodeAuction',
        joinError : req.flash('joinError'),
    });
});

// 상품등록 화면을 렌더링한다.
router.get('/good', isLoggedIn, (req, res) => {
    res.render('good', {title : '상품등록 - NodeAuction'});
});

fs.readdir('uploads', (error) => {
    if (error) {
        console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
        fs.mkdirSync('uploads');
    }
});

// 상품 이미지 업로드 기능(multer 미들웨어)
const upload = multer({
    storage : multer.diskStorage({
        destination(req, file, cb) {
            cb(null, 'uploads/');
        },
        filename(req, file, cb) {
            const ext = path.extname(file.originalname);
            cb(null, path.basename(file.originalname, ext) + new Date().valueOf() + ext);
        },
    }),
    limits : {fileSize : 5 * 1024 * 1024},
});

// 업로드한 상품을 처리하는 라우터
router.post('/good', isLoggedIn, upload.single('img'),  async (req, res, next) => {
    try {
        const {name, price} = req.body;
        const good = await Good.create({
            ownerId : req.user.id,
            name,
            img : req.file.filename,
            price,
        });

        const end = new Date();
        end.setDate(end.getDate() + 1);

        // 스케줄링을 구현하기 위해 node-schedule 모듈을 사용한다.
        // schedule 객체의 scheduleJob 메소드로 일정을 예약할 수 있다.
        // 첫번째 인자는 실행될 시각, 두번째 인자는 해당 시각이 됬을 때 수행할 콜백함수이다.
        schedule.scheduleJob(end, async () => {
            const success = await Auction.find({
                where : {goodId : good.id},
                order : [['bid', 'DESC']],
            });

            await Good.update({soldId : success.userId}, {where : {id:good.id} });
            await User.update({
                money : sequelize.literal(`money - ${success.bid}`),
            }, {
                where : {id : success.userId},
            });
        });

        res.redirect('/');
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/good/:id', isLoggedIn, async (req, res, next) => {
    try {
        const [good, auction] = await Promise.all([
            Good.find({
                where : {id : req.params.id},
                include : {
                    model : User,
                    as : 'owner', // Good 모델과 User 모델은 일대다 관계가 두번 연결되어 있으므로 어떤 관계를 include 할지 as 속성으로 밝혀줘야 한다.
                },
            }),
            Auction.findAll({
                where : {goodId : req.params.id},
                include : {model : User},
                order : [['bid', 'ASC']],
            }),
        ]);

        res.render('auction', {
            title : `${good.name} - NodeAuction`,
            good,
            auction,
            auctionError : req.flash('auctionError'),
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.post('/good/:id/bid', isLoggedIn, async (req, res, next) => {
    try {
        const {bid, msg} = req.body;
        const good = await Good.find({
            where : {id : req.params.id},
            include : {model : Auction},
            order : [[{model : Auction}, 'bid', 'DESC']],
        });

        if (good.price > bid) {
            return res.status(403).send('시작 가격보다 높게 입찰해야 합니다.');
        }

        if (new Date(good.createdAt).valueOf() + (24 * 60 * 60 * 1000) < new Date()) {
            return res.status(403).send('경매가 이미 종료되었습니다.');
        }

        if (good.auctions[0] && good.auctions[0].bid >= bid) {
            return res.status(403).send('이전 입찰가보다 높아야 합니다.');
        }

        const result = await Auction.create({
            bid,
            msg,
            userId : req.user.id,
            goodId : req.params.id,
        });

        req.app.get('io').to(req.params.id).emit('bid', {
            bid : result.bid,
            msg : result.msg,
            nick : req.user.nick,
        });

        return res.send('ok');
    } catch (error) {
        console.error(error);
        return next(error);
    }
});

router.get('/list', isLoggedIn, async (req, res, next) => {
    try {
        const goods = await Good.findAll({
            where : {soldId : req.user.id},
            include : {model : Auction},
            order : [[{model : Auction}, 'bid', 'DESC']],
        });

        res.render('list', {title : '낙찰 목록 - NodeAuction', goods});
    } catch (error) {
        console.error(error);
        next(error);
    }
});

module.exports = router;