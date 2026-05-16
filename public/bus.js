let editId = null;
function addBus(){
  const url = editId
    ? "http://localhost:4000/updateBus/" + editId
    : "http://localhost:4000/addBus";
  const method = editId ? "PUT" : "POST";
  fetch(url,{
    method,
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      bus_number:bus_number.value,
      registration_number:registration_number.value,
      purchase_date:purchase_date.value,
      vehicle_cost:vehicle_cost.value,
      vehicle_make:vehicle_make.value,
      vehicle_capacity:vehicle_capacity.value,
      insurance_date:insurance_date.value,
      fc_date:fc_date.value,
      taxation_paid_upto:taxation_paid_upto.value,
      permit_validity:permit_validity.value,
      pollution_date:pollution_date.value
    })
  })
  .then(r=>r.json())
  .then(m=>{
    alert(m.message);
    editId = null;
    loadBus();
  });
}
// EXPIRY CHECK
function checkExpiry() {
  fetch("http://localhost:4000/checkExpiry")
    .then(r => r.json())
    .then(data => {
      if (data.length === 0) {
        alert("No certificates expiring within 30 days");
        return;
      }
      let msg = "CERTIFICATE EXPIRY ALERT\n\n";
      data.forEach(a => {
        msg += `Bus ${a.busNumber}\n`;
        if (a.status === "EXPIRED") {
          msg += `${a.certificate} certificate EXPIRED\nPlease renew it immediately.\n\n`;
        } 
        else {
          msg += `${a.certificate} expires in ${a.remainingDays} days\n\n`;
        }
      });
      alert(msg);
    })
    .catch(() => alert("Server not responding"));
}
function loadBus(){
fetch("http://localhost:4000/getBuses")
.then(r=>r.json())
.then(d=>{
tableBody.innerHTML="";
d.forEach(b=>{
tableBody.innerHTML+=`
<tr>
<td data-label="Bus">${b.bus_number}</td>
<td data-label="Reg">${b.registration_number}</td>
<td data-label="Purchase">${b.purchase_date?.split('T')[0]}</td>
<td data-label="Cost">${b.vehicle_cost}</td>
<td data-label="Make">${b.vehicle_make}</td>
<td data-label="Capacity">${b.vehicle_capacity}</td>
<td data-label="Insurance">${b.insurance_date?.split('T')[0]}</td>
<td data-label="FC">${b.fc_date?.split('T')[0]}</td>
<td data-label="Tax">${b.taxation_paid_upto?.split('T')[0]}</td>
<td data-label="Permit">${b.permit_validity?.split('T')[0]}</td>
<td data-label="Pollution">${b.pollution_date?.split('T')[0]}</td>
<td data-label="Action" style="white-space:nowrap;">
<button type="button" class="btn-edit" onclick="editBus(${b.id})">Edit</button>
<button type="button" class="btn-delete" onclick="del(${b.id})">Delete</button>
</td>
</tr>`;
});
});
}
// EDIT
function editBus(id){
  fetch("http://localhost:4000/getBus/"+id)
  .then(r=>r.json())
  .then(b=>{
  editId = id;
  bus_number.value = b.bus_number;
  registration_number.value = b.registration_number;
  purchase_date.value = b.purchase_date.split('T')[0];
  vehicle_cost.value = b.vehicle_cost;
  vehicle_make.value = b.vehicle_make;
  vehicle_capacity.value = b.vehicle_capacity;
  insurance_date.value = b.insurance_date.split('T')[0];
  fc_date.value = b.fc_date.split('T')[0];
  taxation_paid_upto.value = b.taxation_paid_upto.split('T')[0];
  permit_validity.value = b.permit_validity.split('T')[0];
  pollution_date.value = b.pollution_date.split('T')[0];
  document.getElementById("formSection").scrollIntoView({
    behavior: "smooth"
  });
  const form = document.getElementById("formSection");
  form.style.boxShadow = "0 0 15px #1976d2";
  setTimeout(()=>{
    form.style.boxShadow = "";
  },1500);
  });
}
// DELETE
function del(id){
  fetch("http://localhost:4000/deleteBus/"+id,{method:"DELETE"})
  .then(loadBus);
}
// PDF
function downloadPDF(){
  window.open("http://localhost:4000/download_PDF");
}
// BACK
function goBack(){
  if(document.referrer){
      window.location.href = document.referrer;
  } else {
      const role = sessionStorage.getItem("role");
      if(role === "admin"){
          window.location.href = "admin.html";
      } else {
          window.location.href = "staff.html";
      }
  }
}
loadBus();