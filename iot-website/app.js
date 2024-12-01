const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');  // Gửi email cảnh báo

// Kết nối với cơ sở dữ liệu
const db = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",  // username MySQL
    password: "admin",
    database: "iot_database"
});

db.connect(err => {
    if (err) throw err;
    console.log("Kết nối Cơ sở dữ liệu thành công!");
});

const app = express();
app.use(bodyParser.json());  // Cho phép gửi dữ liệu JSON

// Đường dẫn API để nhận dữ liệu cảm biến
app.post('/api/sensor-data', (req, res) => {
    const { temperature, humidity, light } = req.body;

    const query = "INSERT INTO sensor_data (temperature, humidity, light) VALUES (?, ?, ?)";
    db.query(query, [temperature, humidity, light], (err, result) => {
        if (err) throw err;
        console.log("Dữ liệu cảm biến đã được lưu!");
        res.status(201).send({ success: true });
    });
});

// Đường dẫn API để điều khiển thiết bị (đèn LED, quạt)
app.put('/api/device-control/:device', (req, res) => {
    const { device, status } = req.params;
    const query = "UPDATE device_control SET status = ? WHERE device_name = ?";
    db.query(query, [status, device], (err, result) => {
        if (err) throw err;
        res.send({ success: true });
    });
});

// Đường dẫn API gửi cảnh báo email
app.post('/api/alert/email', (req, res) => {
    const { subject, message, recipient } = req.body;
    
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'youremail@gmail.com',
            pass: 'yourpassword'
        }
    });

    let mailOptions = {
        from: 'youremail@gmail.com',
        to: recipient,
        subject: subject,
        text: message
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error("Lỗi khi gửi email: ", err);
            res.status(500).send({ error: err });
        } else {
            console.log("Email đã được gửi thành công!");
            res.send({ success: true });
        }
    });
});

app.listen(3001, () => {
    console.log("Server đang chạy trên cổng 3001");
});
