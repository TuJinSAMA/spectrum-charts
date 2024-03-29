import express from 'express';

const app = express();

app.use(express.static('dist'));

const template = `
<!DOCTYPE html>
<html lang="zh">
  <head>
    <title>spectrum-charts</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="bundle.js"></script>
  </body>
</html>
`;

app.get('/', (req, res) => {
  res.send(template);
})

app.listen(3000, () => console.log('server is running at http://localhost:3000 ...'))