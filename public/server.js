const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const argon2 = require("argon2");

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.use(cors());

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

//db
const db = mysql.createConnection({
 host: "localhost",
 user: "root",
 password: "kavitha@10",
 database: "BusCertificateDetails",
 dateStrings: true
});

db.connect(err => {
 if (err) {
 console.log("DB Connection Failed");
 return;
 }
 console.log("MySQL Connected");
});

//date to number

function dateToNumber(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() * 365 +
  (d.getMonth() + 1) * 30 +
  d.getDate();
 }

function todayNumber() {
 const t = new Date();
 return t.getFullYear() * 365 +
 (t.getMonth() + 1) * 30 +
 t.getDate();
}

//hash table

const HASH_SIZE = 5;

function buildHashTable(buses) {
 const table = Array.from({ length: HASH_SIZE }, () => []);

 buses.forEach(bus => {
 const num = parseInt(bus.bus_number.replace(/\D/g, "")) || 0;
 const index = num % HASH_SIZE;
 table[index].push(bus);
 });

 return table;
}


//email 

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "drsivanthi1995@gmail.com",
    pass: "mheukcsjuesuarzg"
  }
});

function sendAdminNotification(subject, message) {

 const mailOptions = {
 from: "drsivanthi1995@gmail.com",
 to: "kavithagnanaraj10@gmail.com",
 subject: subject,
 html: `
 <div style="font-family: Arial; font-size: 18px; line-height: 1.6;">
 ${message}
 </div>
 `
 };

 transporter.sendMail(mailOptions, (err, info) => {
 if (err) {
 console.log("Email Error:", err);
 } else {
 console.log("Email Sent:", info.response);
 }
 });
}

//routes

app.post("/addBus", (req, res) => {
 const b = req.body;

 db.query(
 `INSERT INTO bus_details 
 (bus_number, registration_number, purchase_date, vehicle_cost,
 vehicle_make, vehicle_capacity, insurance_date, fc_date,
 taxation_paid_upto, permit_validity, pollution_date)
 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
 [
 b.bus_number,
 b.registration_number,
 b.purchase_date,
 b.vehicle_cost,
 b.vehicle_make,
 b.vehicle_capacity,
 b.insurance_date,
 b.fc_date,
 b.taxation_paid_upto,
 b.permit_validity,
 b.pollution_date
 ],
 err => {
 if (err) return res.status(500).json(err);
 res.json({ message: "Bus Added Successfully" });
 }
 );
});

app.get("/getBuses", (req, res) => {
 db.query(`SELECT * FROM bus_details`, (err, rows) => {
 if (err) return res.status(500).json(err);
 res.json(rows);
 });
});

app.get("/getBus/:id", (req, res) => {
 db.query(
 "SELECT * FROM bus_details WHERE id=?",
 [req.params.id],
 (err, rows) => {
 if (err) return res.status(500).json(err);
 res.json(rows[0]);
 }
 );
});

app.delete("/deleteBus/:id", (req, res) => {
 db.query(
 "DELETE FROM bus_details WHERE id=?",
 [req.params.id],
 () => res.json({ message: "Deleted Successfully" })
 );
});

app.put("/updateBus/:id", (req, res) => {
 const b = req.body;

 db.query(
 `UPDATE bus_details SET
 bus_number=?, registration_number=?, purchase_date=?, vehicle_cost=?,
 vehicle_make=?, vehicle_capacity=?, insurance_date=?, fc_date=?,
 taxation_paid_upto=?, permit_validity=?, pollution_date=?
 WHERE id=?`,
 [
 b.bus_number,
 b.registration_number,
 b.purchase_date,
 b.vehicle_cost,
 b.vehicle_make,
 b.vehicle_capacity,
 b.insurance_date,
 b.fc_date,
 b.taxation_paid_upto,
 b.permit_validity,
 b.pollution_date,
 req.params.id
 ],
 () => res.json({ message: "Updated Successfully" })
 );
});


app.get("/checkExpiry", (req, res) => {

 db.query("SELECT * FROM bus_details", (err, buses) => {

 if (err) return res.status(500).json(err);

 const today = todayNumber();
 const alerts = [];

 buses.forEach(bus => {

 [
 { name: "Insurance", date: bus.insurance_date },
 { name: "FC", date: bus.fc_date },
 { name: "Permit", date: bus.permit_validity },
 { name: "pollution", date: bus.pollution_date }
 ].forEach(c => {

 const exp = dateToNumber(c.date);
 if (exp === null || isNaN(exp)) return;

 const remaining = exp - today;
 if (isNaN(remaining)) return;

 if (remaining <= 30) {
 alerts.push({
 busNumber: bus.bus_number,
 certificate: c.name,
 remainingDays: remaining,
 status: remaining < 0 ? "EXPIRED" : "WARNING"
 });
 }

 });

 });

 res.json(alerts);

 });

});


app.get("/download_PDF", (req, res) => {

 db.query("SELECT * FROM bus_details", (err, rows) => {

 if (err) return res.status(500).json(err);

 const doc = new PDFDocument();
 res.setHeader("Content-Type", "application/pdf");
 res.setHeader("Content-Disposition", "attachment; filename=BusDetails.pdf");

 doc.pipe(res);

 doc.fontSize(18).text("Bus Details Report", { align: "center" });
 doc.moveDown();

 rows.forEach((bus, index) => {
 doc.fontSize(12).text(
 `${index + 1}. Bus: ${bus.bus_number} | Reg: ${bus.registration_number}`
 );
 doc.text(`Make: ${bus.vehicle_make} | Capacity: ${bus.vehicle_capacity}`);
 doc.text(`Insurance: ${bus.insurance_date}`);
 doc.text(`FC: ${bus.fc_date}`);
 doc.text(`Permit: ${bus.permit_validity}`);
 doc.text(`Pollution: ${bus.pollution_date}`);
 doc.moveDown();
 });

 doc.end();

 });

});

//expiry check

function autoExpiryCheck() {

 console.log("Running Daily Expiry Check...");

 db.query("SELECT * FROM bus_details", (err, buses) => {

 if (err) return;

 const table = buildHashTable(buses);
 const today = todayNumber();

 table.forEach(chain => {

 chain.forEach(bus => {

 [
 { name: "Insurance", date: bus.insurance_date },
 { name: "FC", date: bus.fc_date },
 { name: "Permit", date: bus.permit_validity },
 { name: "Pollution", date: bus.pollution_date }
 ].forEach((c ,index)=> {

 const exp = dateToNumber(c.date);
 if (exp === null) return;

 const remaining = exp - today;

 if (remaining < 0) {

 //Expired
 const subject = "Bus Certificate Expired";
 
 const message = `
 <h2 style="color:red;">Bus Certificate EXPIRED</h2>
 <p><strong>Bus Number:</strong> ${bus.bus_number}</p>
 <p><strong>Certificate:</strong> ${c.name}</p>
 <p style="color:red; font-weight:bold;">
 Please renew immediately.
 </p>
 `;
 setTimeout(() => {
    sendAdminNotification(subject, message);
  }, index * 3000); 
 } else if (remaining <= 31) {
 
 //expiried soon
 const subject = "Bus Certificate Expiry Reminder";
 
 const message = `
 <h2 style="color:orange;">Bus Certificate Expiry Reminder</h2>
 <p><strong>Bus Number:</strong> ${bus.bus_number}</p>
 <p><strong>Certificate:</strong> ${c.name}</p>
 <p>
 Only <strong>${remaining} days</strong> left.
 </p>
 <p style="font-weight:bold;">
 Please renew immediately.
 </p>
 `;
let delay = 0;

[
 { name: "Insurance", date: bus.insurance_date },
 { name: "FC", date: bus.fc_date },
 { name: "Permit", date: bus.permit_validity },
 { name: "Pollution", date: bus.pollution_date }
].forEach(c => {

 const exp = dateToNumber(c.date);
 if (!exp) return;

 const remaining = exp - today;

 let subject = "";
 let message = "";

 if (remaining < 0) {

   subject = "Bus Certificate Expired";

   message = `
   <h2 style="color:red;">Bus Certificate EXPIRED</h2>
   <p><strong>Bus Number:</strong> ${bus.bus_number}</p>
   <p><strong>Certificate:</strong> ${c.name}</p>
   <p style="color:red; font-weight:bold;">
   Please renew immediately.
   </p>
   `;

 } else if (remaining <= 31) {

   subject = "Bus Certificate Expiry Reminder";

   message = `
   <h2 style="color:orange;">Bus Certificate Expiry Reminder</h2>
   <p><strong>Bus Number:</strong> ${bus.bus_number}</p>
   <p><strong>Certificate:</strong> ${c.name}</p>
   <p>
   Only <strong>${remaining} days</strong> left.
   </p>
   <p style="font-weight:bold;">
   Please renew immediately.
   </p>
   `;
 }

 if (subject) {
   setTimeout(() => {
     sendAdminNotification(subject, message);
   }, delay);

   delay += 3000; 
 }

});
 }
 });
 });
 });
 });
}




//cron
cron.schedule("35 23 * * *", autoExpiryCheck);

app.post("/addExpense", (req, res) => {

 const e = req.body;

 const total_cost =
 e.expense_type === "Repair"
 ? (parseFloat(e.labour_cost || 0) + parseFloat(e.spare_parts_cost || 0))
 : parseFloat(e.fuel_cost || 0);

 db.query(
 `INSERT INTO bus_expense
 (bus_number, registration_number, expense_date, expense_type, fuel_type,
 labour_cost, spare_parts, spare_parts_cost,
 fuel_quantity, fuel_price_per_litre, fuel_cost, total_cost)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
 [
 e.bus_number,
 e.registration_number,
 e.expense_date,
 e.expense_type,
 e.fuel_type || "",
 e.labour_cost || 0,
 e.spare_parts || "",
 e.spare_parts_cost || 0,
 e.fuel_quantity || 0,
 e.fuel_price_per_litre || 0,
 e.fuel_cost || 0,
 total_cost
 ],
 (err) => {
 if (err) {
 console.log(err);
 return res.status(500).json(err);
 }
 res.json({ message: "Expense Added Successfully" });
 }
 );
});


app.get("/getBusByNumber/:bus_number", (req, res) => {
 db.query(
 "SELECT registration_number FROM bus_details WHERE bus_number=?",
 [req.params.bus_number],
 (err, rows) => {
 if (err) return res.status(500).json(err);
 res.json(rows[0]);
 }
 );
});

app.get("/getExpenses", (req, res) => {

 db.query(
 "SELECT * FROM bus_expense ORDER BY expense_date DESC",
 (err, rows) => {
 if (err) {
 console.log(err);
 return res.status(500).json(err);
 }
 res.json(rows);
 }
 );

});

app.delete("/deleteExpense/:id", (req, res) => {

 db.query(
 "DELETE FROM bus_expense WHERE id=?",
 [req.params.id],
 (err) => {
 if (err) return res.status(500).json(err);
 res.json({ message: "Deleted Successfully" });
 }
 );

});

app.get("/getExpenseById/:id", (req, res) => {

 db.query(
 "SELECT * FROM bus_expense WHERE id=?",
 [req.params.id],
 (err, rows) => {
 if (err) return res.status(500).json(err);
 res.json(rows[0]);
 }
 );

});

app.get("/monthlyReport", (req,res)=>{

const bus=req.query.bus;
const month=req.query.month;

const sql=`
SELECT 
bus_number,
DATE_FORMAT(expense_date,'%Y-%m') AS month,
SUM(total_cost) AS total
FROM bus_expense
WHERE bus_number=? 
AND DATE_FORMAT(expense_date,'%Y-%m')=?
GROUP BY bus_number,month
`;

db.query(sql,[bus,month],(err,rows)=>{

if(err) return res.status(500).json(err);

res.json(rows);
});
});

app.get("/downloadMonthlyPDF",(req,res)=>{

const bus=req.query.bus;
const month=req.query.month;

const sql=`
SELECT bus_number,expense_date,expense_type,total_cost
FROM bus_expense
WHERE bus_number=?
AND DATE_FORMAT(expense_date,'%Y-%m')=?
ORDER BY expense_date
`;

db.query(sql,[bus,month],(err,results)=>{

if(err) return res.status(500).send(err);

const doc=new PDFDocument({margin:40});

res.setHeader("Content-Type","application/pdf");
res.setHeader("Content-Disposition","attachment; filename=monthly_report.pdf");

doc.pipe(res);

doc.fontSize(20).text("Bus Monthly Expense Report",{align:"center"});
doc.moveDown();

doc.fontSize(12).text(`Bus Number : ${bus}`);
doc.text(`Month : ${month}`);
doc.moveDown(2);

let startX=50;
let startY=150;
let rowHeight=25;

doc.fontSize(12);

doc.rect(startX,startY,60,rowHeight).stroke().text("S.No",startX+15,startY+7);

doc.rect(startX+60,startY,120,rowHeight).stroke()
.text("Date",startX+95,startY+7);

doc.rect(startX+180,startY,120,rowHeight).stroke()
.text("Expense Type",startX+200,startY+7);

doc.rect(startX+300,startY,120,rowHeight).stroke()
.text("Amount",startX+340,startY+7);

let y=startY+rowHeight;
let total=0;

results.forEach((row,i)=>{

doc.rect(startX,y,60,rowHeight).stroke()
.text(i+1,startX+25,y+7);

doc.rect(startX+60,y,120,rowHeight).stroke()
.text(row.expense_date,startX+90,y+7);

doc.rect(startX+180,y,120,rowHeight).stroke()
.text(row.expense_type,startX+210,y+7);

doc.rect(startX+300,y,120,rowHeight).stroke()
.text("Rs "+row.total_cost,startX+340,y+7);

y+=rowHeight;
total+=parseFloat(row.total_cost);
});

doc.moveDown(2);
doc.fontSize(14).text(`Grand Total : Rs ${total}`,50,y+20);
doc.end();
});
});

app.put("/updateExpense/:id", (req, res) => {

 const e = req.body;

 const total_cost =
 e.expense_type === "Repair"
 ? (parseFloat(e.labour_cost || 0) + parseFloat(e.spare_parts_cost || 0))
 : parseFloat(e.fuel_cost || 0);

 db.query(
 `UPDATE bus_expense SET
 bus_number=?, registration_number=?, expense_date=?, expense_type=?,fuel_type=?,
 labour_cost=?, spare_parts=?, spare_parts_cost=?,
 fuel_quantity=?, fuel_price_per_litre=?, fuel_cost=?, total_cost=?
 WHERE id=?`,
 [
 e.bus_number,
 e.registration_number,
 e.expense_date,
 e.expense_type,
 e.fuel_type || "",
 e.labour_cost || 0,
 e.spare_parts || "",
 e.spare_parts_cost || 0,
 e.fuel_quantity || 0,
 e.fuel_price_per_litre || 0,
 e.fuel_cost || 0,
 total_cost,
 req.params.id
 ],
 (err) => {
 if (err) return res.status(500).json(err);
 res.json({ message: "Updated Successfully" });
 }
 );
});

app.get("/download-expense-report", (req, res) => {

const sql = "SELECT bus_number, expense_date, expense_type, total_cost FROM bus_expense ORDER BY expense_date";

db.query(sql, (err, results) => {

if (err) return res.status(500).send(err);

const doc = new PDFDocument({ margin: 40 });

res.setHeader("Content-Type", "application/pdf");
res.setHeader("Content-Disposition", "attachment; filename=bus_expense_report.pdf");

doc.pipe(res);

doc.fontSize(18).text("Bus Monthly Expense Report", { align: "center" });
doc.moveDown(2);

let startX = 50;
let startY = 120;
let rowHeight = 25;

doc.fontSize(12);

doc.rect(startX, startY, 80, rowHeight).stroke().text("Bus No", startX+10, startY+7);
doc.rect(startX+80, startY, 120, rowHeight).stroke().text("Date", startX+90, startY+7);
doc.rect(startX+200, startY, 120, rowHeight).stroke().text("Type", startX+230, startY+7);
doc.rect(startX+320, startY, 120, rowHeight).stroke().text("Total Cost", startX+340, startY+7);

let y = startY + rowHeight;
let total = 0;

results.forEach(row => {

 doc.rect(startX, y, 80, rowHeight).stroke();
 doc.text(row.bus_number, startX, y+7, { width: 80, align: "center" });
 
 doc.rect(startX+80, y, 120, rowHeight).stroke();
 doc.text(
 row.expense_date,
 startX+80,
 y+7,
 { width: 120, align: "center" }
 );
 
 doc.rect(startX+200, y, 120, rowHeight).stroke();
 doc.text(row.expense_type, startX+200, y+7, { width: 120, align: "center" });
 
 doc.rect(startX+320, y, 120, rowHeight).stroke();
 doc.text(
 "Rs. " + parseFloat(row.total_cost).toFixed(2),
 startX+320,
 y+7,
 { width: 120, align: "center" }
 );

 y += rowHeight; 
 total += parseFloat(row.total_cost);
 });

doc.moveDown(2);
doc.fontSize(14).text(`Total Monthly Expense : Rs. ${total}`, 50, y+20);
doc.end();
});
});


app.get("/getStudentsByRoute", (req, res) => {

  const route = req.query.route;
  
  if (!route) {
  return res.status(400).json({ message: "Route is required" });
  }
  
  db.query(
  "SELECT * FROM students WHERE route_name = ?",
  [route],
  (err, rows) => {
  if (err) {
  console.log(err);
  return res.status(500).json({ message: "Database error" });
  }
  res.json(rows);
  }
  );
});
app.post("/saveAttendance", (req, res) => {
  const { route_name, students, date, section } = req.body; 
  if (!route_name || !date || !section) {
  return res.json({ message: "Missing data ❌" });
  }
  db.query(
  "SELECT COUNT(*) AS count FROM attendance WHERE route_name=? AND date=? AND section=?",
  [route_name, date, section],
  (err, result) => {
  if (err) return res.status(500).json({ message: "DB Error" });
  if (result[0].count > 0) {
  return res.json({ message: "Already taken for this session ❌" });
  }
  let values = students.map(s => [
  s.id,
  route_name,
  date,
  section,
  s.status || "Present"   
  ]);
  db.query(
  "INSERT INTO attendance (student_id, route_name, date, section, status) VALUES ?",
  [values],
  (err) => {
  if (err) {
  console.log(err);
  return res.status(500).json({ message: "Insert Failed ❌" });
  }
  res.json({ message: "Attendance Saved ✅" });
  });
  }
  );
});
app.get("/getAttendanceByRoute", (req, res) => {
  const { route, date, section } = req.query;
  db.query(
  `SELECT s.name, a.status
   FROM attendance a
   JOIN students s ON a.student_id = s.id
   WHERE a.route_name = ?
   AND a.date = ?
   AND a.section = ?`,
  [route, date, section],
  (err, rows) => {
  if (err) {
  console.log(err);
  return res.status(500).json({ message: "DB error" });
  }
  const present = rows.filter(r => r.status === "Present");
  const absent = rows.filter(r => r.status === "Absent");
  res.json({ present, absent });
  }
  );
});
app.post("/addStudent", (req, res) => {

 const { name, bus_number, stop_name, year, reservation } = req.body;

 const sql = `
  INSERT INTO students (name, bus_number, stop_name, year, reservation)
  VALUES (?, ?, ?, ?, ?)
 `;

 db.query(sql, [name, bus_number, stop_name, year, reservation], (err, result) => {
  if (err) return res.status(500).json(err);
  res.json({ message: "Student Added Successfully" });
 });
});

app.get("/getStops/:route", (req, res) => {

  const route = req.params.route;
  
  db.query(
  "SELECT stop_name FROM bus_stops WHERE route_name = ?",
  [route],
  (err, result) => {
  if (err) {
  console.log(err);
  return res.json([]);
  }
  res.json(result);
  }
  );
});
app.get("/getStudentsByStop", (req, res) => {

  const stop = req.query.stop;
  
  db.query(
  "SELECT name,year, route_name FROM students WHERE stop_name = ?",
  [stop],
  (err, rows) => {
  res.json(rows);
  }
  );
});
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query(
    "SELECT * FROM login WHERE username = ?",
    [username],
    async (err, result) => {
      if (err) return res.json({ message: "Error" });

      if (result.length === 0) {
        return res.json({ message: "User not found" });
      }

      const user = result[0];

      const isMatch = await argon2.verify(user.password, password);

      if (isMatch) {
        res.json({
          message: "Login Success",
          role: user.role
        });
      } else {
        res.json({ message: "Invalid Password" });
      }
    }
  );
});
app.post("/updateStudent", (req, res) => {

  const { id, name, year, stop } = req.body;
  console.log(req.body); 
  const sql = `
    UPDATE students 
    SET name = ?, year = ?, stop_name = ? 
    WHERE id = ?
  `;
  db.query(sql, [name, year, stop, id], (err, result) => {
    if (err) {
      console.log(err);
      return res.send("Error");
    }
    console.log(result);
    res.send("Updated Successfully");
  });
});
app.get("/deleteStudent", (req, res) => {
  const { id } = req.query;
  db.query("DELETE FROM students WHERE id=?", [id], (err) => {
    if(err) return res.json({message:"Error"});
    res.json({message:"Deleted"});
  });
});
app.listen(4000, () => {
 console.log("Server running on http://localhost:4000");
});