const router = require('express').Router();
const { DiagnosisController } = require('../controllers/diagnosis.controller');
const { authenticateToken, requireRoles } = require('../middlewares/auth.middleware');

router.use(authenticateToken);

router.get('/', DiagnosisController.getAll);
router.get('/statistics', DiagnosisController.getStatistics);
router.get('/search', DiagnosisController.searchByIcd10);
router.get('/:id', DiagnosisController.getOne);
router.get('/patient/:patientId/active', DiagnosisController.getActiveByPatient);
router.post('/', requireRoles('ADMIN', 'DOCTOR'), DiagnosisController.create);
router.put('/:id', requireRoles('ADMIN', 'DOCTOR'), DiagnosisController.update);
router.delete('/:id', requireRoles('ADMIN'), DiagnosisController.delete);

module.exports = router;