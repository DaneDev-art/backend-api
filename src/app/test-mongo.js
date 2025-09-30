const mongoose = require('mongoose');

mongoose.connect('mongodb://mongo:27017/nom_de_ta_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB connecté !');
  process.exit(0);
})
.catch(err => {
  console.error('Erreur MongoDB :', err);
  process.exit(1);
});
