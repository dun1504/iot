const express = require('express');
const http = require("http");
const socketIo = require("socket.io")
const app = express();
const mqtt = require('mqtt');
const bodyParser = require("body-parser");
const mysql = require('mysql2');
const moment = require('moment-timezone'); // Sử dụng thư viện moment-timezone
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
  }
});
// Add headers before the routes are defined
app.use(function (req, res, next) {

  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});
// Kết nối tới broker MQTT
const client = mqtt.connect('mqtt://localhost:1883'); // Điều chỉnh URL MQTT broker nếu cần
// Kết nối tới cơ sở dữ liệu MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'iot'
});
db.connect((err) => {
  if (err) {
    console.error('Lỗi kết nối đến cơ sở dữ liệu MySQL:', err);
  } else {
    console.log('Kết nối đến cơ sở dữ liệu MySQL thành công.');
  }
});
// Khi kết nối thành công
client.on('connect', function () {
  console.log('Connected to MQTT broker');

  // Subscribe vào topic để nhận dữ liệu từ ESP8266
  client.subscribe('temp');
  client.subscribe('humi');
  client.subscribe('light');
  client.subscribe('ledStatus1');
  client.subscribe('ledStatus2');
});
function saveDataToMySQL(temperature, humidity, light) {
  const sql = 'INSERT INTO sensor_data (temperature, humidity, light) VALUES (?, ?, ?)';
  const values = [temperature, humidity, light];

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error('Lỗi khi lưu dữ liệu vào MySQL:', err);
    } else {
      console.log('Dữ liệu đã được lưu vào MySQL.');
    }
  });
}

function saveLedDataToMySQL(ledNo, status) {
  const sql = 'INSERT INTO led_status (led, status) VALUES (?, ?)';
  const values = [ledNo, status];

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error('Lỗi khi lưu dữ liệu vào MySQL:', err);
    } else {
      console.log('Dữ liệu led đã được lưu vào MySQL.');
    }
  });
}
// Khi nhận được dữ liệu từ ESP8266
let temp = 0;
let humi = 0;
let light = 0;
client.on('message', function (topic, message) {
  if (topic === 'temp') {
    temp = parseFloat(message.toString());
    // Làm điều gì đó với giá trị độ ẩm
  }
  if (topic === 'humi') {
    humi = parseFloat(message.toString());
    // Làm điều gì đó với giá trị cường độ ánh sáng
  }
  if (topic === 'light') {
    light = parseFloat(message.toString());
    // console.log(light);
    // Làm điều gì đó với giá trị cường độ ánh sáng
    saveDataToMySQL(temp, humi, light);
  }
  if (topic === 'ledStatus1') {
    // Xử lý thông tin trạng thái đèn
    const lightStatus1 = message.toString();
    console.log(lightStatus1);

    const sql = `SELECT * FROM led_status WHERE led = 'ledStatus1' ORDER BY id DESC LIMIT 1`;

    db.query(sql, (err, results) => {
      if (err) {
        console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        (results[0].status !== lightStatus1) ? saveLedDataToMySQL(topic, lightStatus1) : console.log();
      }
    })
    io.emit('updateLedStatus1', lightStatus1);
  }
  if (topic === 'ledStatus2') {
    // Xử lý thông tin trạng thái đèn
    const lightStatus2 = message.toString();
    console.log(lightStatus2);

    const sql = `SELECT * FROM led_status WHERE led = 'ledStatus2' ORDER BY id DESC LIMIT 1`;

    db.query(sql, (err, results) => {
      if (err) {
        console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        (results[0].status !== lightStatus2) ? saveLedDataToMySQL(topic, lightStatus2) : console.log();
      }
    })
    io.emit('updateLedStatus2', lightStatus2);
  }
});
app.get('/', (req, res) => {
  res.send('hello quan!');
})
app.get('/api/latestData', (req, res) => {
  const sql = 'SELECT * FROM sensor_data ORDER BY id DESC LIMIT 10';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      // Chuyển đổi múi giờ của timestamp từ UTC sang múi giờ Hà Nội
      const resultsWithHanoiTime = results.map(result => {
        const utcTimestamp = moment(result.timestamp).utc();
        const hanoiTimestamp = utcTimestamp.clone().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss');
        const hanoiTime = utcTimestamp.clone().tz('Asia/Ho_Chi_Minh').format('HH:mm:ss');
        return {
          ...result,
          timestamp: hanoiTimestamp,
          time: hanoiTime,
        };
      });

      res.json(resultsWithHanoiTime.reverse());
    }
  });
});
app.get('/api/lastStatusLed1', (req, res) => {
  const sql = `SELECT * FROM led_status WHERE led = 'ledStatus1' ORDER BY id DESC LIMIT 1`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(results[0]);
    }
  })
})
app.get('/api/lastStatusLed2', (req, res) => {
  const sql = `SELECT * FROM led_status WHERE led = 'ledStatus2' ORDER BY id DESC LIMIT 1`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(results[0]);
    }
  })
})
app.get('/api/data/history', (req, res) => {
  const { startTime, endTime } = req.query;
  const sql = `SELECT * FROM sensor_data WHERE timestamp >= FROM_UNIXTIME(?) AND timestamp <= FROM_UNIXTIME(?)`;

  db.query(sql, [startTime, endTime], (err, results) => {
    if (err) {
      console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      const resultsWithHanoiTime = results.map(result => {
        const utcTimestamp = moment(result.timestamp).utc();
        const hanoiTimestamp = utcTimestamp.clone().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss');
        return {
          ...result,
          timestamp: hanoiTimestamp,
        };
      });

      res.json(resultsWithHanoiTime.reverse());
    }
  });
});
app.get('/api/oneLatestData', (req, res) => {
  const query = 'SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1';

  db.query(query, (err, result) => {
    if (err) {
      console.error('Lỗi truy vấn cơ sở dữ liệu: ' + err);
      res.status(500).send('Lỗi truy vấn cơ sở dữ liệu');
      return;
    }

    if (result.length > 0) {
      res.json(result[0]);
    } else {
      res.status(404).send('Không tìm thấy dữ liệu');
    }
  });
});

app.use(bodyParser.json());
app.post("/api/toggleLed1", (req, res) => {
  const { isEnabled } = req.body;

  // Gửi yêu cầu thông qua MQTT để điều khiển đèn LED
  const topic = "topic/led1";
  const message = isEnabled ? "1" : "0";

  client.publish(topic, message, () => {
    res.json({ success: true });
  });
});

app.post("/api/toggleLed2", (req, res) => {
  const { isEnabled } = req.body;

  // Gửi yêu cầu thông qua MQTT để điều khiển đèn LED
  const topic = "topic/led2";
  const message = isEnabled ? "1" : "0";

  client.publish(topic, message, () => {
    res.json({ success: true });
  });
});
let lightStatus = 'off';
app.get('/api/lightStatus', (req, res) => {
  // Trả về trạng thái của đèn LED dưới dạng JSON
  res.json({ status: lightStatus });
});

// led history

app.get('/api/latestDataLed', (req, res) => {
  const sql = 'SELECT * FROM led_status ORDER BY id DESC LIMIT 10';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      // Chuyển đổi múi giờ của timestamp từ UTC sang múi giờ Hà Nội
      const resultsWithHanoiTime = results.map(result => {
        const utcTimestamp = moment(result.timestamp).utc();
        const hanoiTimestamp = utcTimestamp.clone().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss');
        const hanoiTime = utcTimestamp.clone().tz('Asia/Ho_Chi_Minh').format('HH:mm:ss');
        return {
          ...result,
          timestamp: hanoiTimestamp,
          time: hanoiTime,
        };
      });

      res.json(resultsWithHanoiTime.reverse());
    }
  });
});

app.get('/api/data/historyLed', (req, res) => {
  const { startTime, endTime } = req.query;
  const sql = `SELECT * FROM led_status WHERE timestamp >= FROM_UNIXTIME(?) AND timestamp <= FROM_UNIXTIME(?)`;

  db.query(sql, [startTime, endTime], (err, results) => {
    if (err) {
      console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      const resultsWithHanoiTime = results.map(result => {
        const utcTimestamp = moment(result.timestamp).utc();
        const hanoiTimestamp = utcTimestamp.clone().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss');
        return {
          ...result,
          timestamp: hanoiTimestamp,
        };
      });

      res.json(resultsWithHanoiTime.reverse());
    }
  });
});
const port = 8888;
app.use(express.static("build"));
server.listen(port, () => {
  console.log(`Máy chủ chạy tại cổng ${port}`);
});
// Lắng nghe mỗi 2 giây
// setInterval(function () {
//   console.log('Waiting for data from ESP8266...');
// }, 2000);