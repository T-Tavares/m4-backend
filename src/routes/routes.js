// ROUTER INIT
const express = require('express');
const router = express.Router();

// MULTER => FILES HANDLER
const multer = require('multer');
const upload = multer({dest: 'tempImages/'}); // Multer Shadow files location => Go to controller.js l-29 for details

// CONTROLLERS IMPORTS
const analyseCarImage = require('../controllers/controller');
const fetchTurnersCarsList = require('../controllers/mongoDBControllers');

// ROUTES
router.get('/', (_, res) => res.send('server is up'));
router.get('/turners-db', async (_, res) => res.send(await fetchTurnersCarsList()));
router.post('/analyse-car-image', upload.single('car-image'), (req, res) => analyseCarImage(req, res));

// EXPORT ROUTER
module.exports = router;
