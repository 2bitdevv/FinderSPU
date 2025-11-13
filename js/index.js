/* 
   ตั้งค่าและการเชื่อมต่อ (Configuration & Initialization)
   Firebase และ Cloudinary 
*/
// นำเข้า Module Firebase CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  initializeFirestore,
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ตั้งค่า Cloudinary สำหรับอัปโหลดรูปภาพ 
const CLOUD_NAME = "dl3a6hwhm";
const UPLOAD_PRESET = "unsigned_preset";

// configure Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDafiXTtHLUmUV5qiaSOqoWQqegm_WuQ_8",
  authDomain: "finderspu.firebaseapp.com",
  projectId: "finderspu",
  storageBucket: "finderspu.appspot.com",
  messagingSenderId: "850517172964",
  appId: "1:850517172964:web:db6e8c40ab0e53efbbc2f1",
  measurementId: "G-F803Z50WVP",
};

// เริ่มต้นการทำงานของ Firebase และ Firestore Database
const app = initializeApp(firebaseConfig);
initializeFirestore(app, { experimentalForceLongPolling: true }); // แก้ปัญหาการเชื่อมต่อในบาง Network
const db = getFirestore(app);

console.log("🔥🔥🔥 Firebase connected:", app.name);

// ให้หน้าเว็บ DOM โหลดเสร็จสมบูรณ์ก่อนเริ่มทำงาน
document.addEventListener("DOMContentLoaded", async () => {
  
  /* อ้างอิง Element ในหน้าเว็บ DOM References ดึงตัวแปรจาก HTML มาเก็บไว้เพื่อให้เรียกใช้ได้ง่าย */
  const list = document.getElementById("list");                    // กล่องรายการโพสต์
  const modal = document.getElementById("postModal");              // หน้าต่าง Modal สำหรับสร้าง/แก้ไข
  const openBtn = document.getElementById("letpost");              // ปุ่มเปิด Modal "ประกาศใหม่"
  const closeBtn = document.getElementById("closeModal");          // ปุ่มปิด Modal
  const form = document.getElementById("postForm");                // ฟอร์มกรอกข้อมูล
  
  // Element สำหรับ Modal จัดการโพสต์ ลบ/แก้ไข/คืนของ
  const manageModal = document.getElementById("manageModal");
  const closeManage = document.getElementById("closeManage");
  const editBtn = document.getElementById("editPost");
  const markReturned = document.getElementById("markReturned");
  const deleteBtn = document.getElementById("deletePost");
  let currentPostCard = null;                                      // ตัวแปรจำว่ากำลังกดการ์ดใบไหนอยู่
  
  // Element สำหรับค้นหาและตัวกรอง
  const searchInput = document.querySelector('.search-form input[type="text"]');
  const categorySelect = document.getElementById("categorySelect");
  const statusSelect = document.getElementById("statusSelect");
  const timeSelect = document.getElementById("timeSelect");
  
  // ตั้งค่า Pagination แบ่งหน้า
  const perPage = 12;                                              // แสดง 12 การ์ดต่อหน้า
  let currentPage = 1;                                             // หน้าปัจจุบันเริ่มที่ 1
  
  // Variable ป้องกันการกดปุ่มรัวๆ Double Submit Protection
  let isSubmitting = false;                                    

/* ฟังก์ชันช่วยเหลือทั่วไป Utility Functions
   ฟังก์ชันแปลงค่า วันที่, ข้อความ, และอัปโหลดรูป
*/

// Debounce หน่วงเวลาค้นหา ไม่ให้กระตุกเวลาพิมพ์เร็วๆ
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

// ฟังก์ชันดึงการ์ดทั้งหมดในรายการออกมาเป็น Array
function getCards() {
  return Array.from(list.querySelectorAll(".card"));
}

// คำนวณจำนวนหน้าทั้งหมด จากการ์ดที่แสดงอยู่
function getTotalPages() {
  const visibleCards = getCards().filter(card => card.style.display !== "none");
  return Math.max(1, Math.ceil(visibleCards.length / perPage));
}

// แปลง Key ภาษาอังกฤษ > เป็นชื่อไทย สำหรับแสดงผล
function mapCategory(key) {
  const categoryMap = {
    card: "บัตร/เอกสาร",
    electronics: "อิเล็กทรอนิกส์",
    clothing: "เสื้อผ้า",
    personal: "ของใช้ส่วนตัว",
  };
  return categoryMap[key] || "อื่นๆ";
}

// แปลงชื่อไทย > กลับเป็น Key ภาษาอังกฤษ สำหรับบันทึกลง Database
function reverseCategory(name) {
  const reverseCategoryMap = {
    "บัตร/เอกสาร": "card",
    "อิเล็กทรอนิกส์": "electronics",
    "เสื้อผ้า": "clothing",
    "ของใช้ส่วนตัว": "personal",
  };
  return reverseCategoryMap[name] || "other";
}

// แปลงวันที่ให้เป็น Format ที่ใส่ลงใน input type="datetime-local" ได้
function formatDateForInput(str) {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ฟังก์ชันอัปโหลดรูปไป Cloudinary
async function uploadImageToCloudinary(file) {
  if (!file) return null;
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    // ยิง Request ไปที่ API ของ Cloudinary
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );
    
    const data = await response.json();
    return data.secure_url; // ส่งคืน URL รูปที่ได้มา
  } catch (error) {
    console.error("Error uploading image:", error);
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด!',
      text: 'ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#d33' // สีแดง
    });
    return null;
  }
}
  
/* 
   ระบบแบ่งหน้า Pagination Logic
   จัดการการแสดงผลทีละหน้า และปุ่มกดเปลี่ยนหน้า
*/

// ฟังก์ชันแสดงการ์ดเฉพาะหน้าปัจจุบัน
function showPage(page) {
  const allCards = getCards();
  const visibleCards = allCards.filter(card => card.style.display !== "none");
  const totalPages = getTotalPages();
  
  // ตรวจสอบเลขหน้าให้อยู่ในขอบเขตที่ถูกต้อง
  page = Math.min(Math.max(page, 1), totalPages);
  currentPage = page;
  
  // คำนวณว่าจะแสดงการ์ดลำดับที่เท่าไหร่ถึงเท่าไหร่
  const start = (page - 1) * perPage;
  const end = start + perPage;
  
  // ซ่อนการ์ดทั้งหมดก่อน
  allCards.forEach(card => {
    if (card.style.display !== "none") {
      card.classList.add('paginated-hidden');
    }
  });
  
  // แสดงเฉพาะการ์ดที่อยู่ในช่วงของหน้านั้น
  visibleCards.forEach((card, i) => {
    if (i >= start && i < end) {
      card.classList.remove('paginated-hidden');
    }
  });
  
  // เพิ่มปุ่มเปลี่ยนหน้าใหม่เมื่อครบจำนวนการ์ด
  renderPagination();
}

  // ฟังก์ชันสร้างปุ่มเปลี่ยนหน้า Next, Prev, 1, 2, 3...
  function renderPagination() {
    let pagination = document.querySelector(".pagination");
    const totalPages = getTotalPages();
    
    // ถ้ามีหน้าเดียว ไม่ต้องโชว์ปุ่มเปลี่ยนหน้า
    if (totalPages <= 1) {
      if (pagination) pagination.style.display = 'none';
      return;
    }
    
    // สร้าง Container ปุ่ม
    if (!pagination) {
      pagination = document.createElement("div");
      pagination.className = "pagination";
      list.after(pagination);
      
      // ดักจับการกดปุ่มเปลี่ยนหน้า
      pagination.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-page]");
        if (!btn) return;
        const page = Number(btn.dataset.page);
        if (!Number.isNaN(page)) showPage(page);
      });
    }
    
    pagination.style.display = 'flex';
    pagination.innerHTML = "";
    
    // ฟังก์ชันช่วยสร้าง HTML ปุ่ม
    const makeBtn = (label, page, extra = "", dis = false) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.page = page;
      b.className = `page-btn ${extra}`;
      if (dis) b.disabled = true;
      return b;
    };
    
    // ปุ่มย้อนกลับ <
    pagination.appendChild(makeBtn("<", Math.max(1, currentPage - 1), "prev", currentPage === 1));
    
    // Logic การแสดงเลขหน้า แบบย่อ ...
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pagination.appendChild(makeBtn(i, i, i === currentPage ? "active" : ""));
      }
    } else {
      pagination.appendChild(makeBtn(1, 1, currentPage === 1 ? "active" : ""));
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) { start = 2; end = 4; } 
      else if (currentPage >= totalPages - 2) { start = totalPages - 3; end = totalPages - 1; }
      
      if (start > 2) {
        const span = document.createElement("span");
        span.className = "ellipsis"; span.textContent = "..."; pagination.appendChild(span);
      }
      
      for (let i = start; i <= end; i++) {
        pagination.appendChild(makeBtn(i, i, i === currentPage ? "active" : ""));
      }
      
      if (end < totalPages - 1) {
        const span = document.createElement("span");
        span.className = "ellipsis"; span.textContent = "..."; pagination.appendChild(span);
      }
      
      pagination.appendChild(makeBtn(totalPages, totalPages, currentPage === totalPages ? "active" : ""));
    }
    
    // ปุ่มถัดไป >
    pagination.appendChild(makeBtn(">", Math.min(totalPages, currentPage + 1), "next", currentPage === totalPages));
    
    // แสดงเลขหน้าปัจจุบัน
    const info = document.createElement("div");
    info.className = "page-info";
    info.textContent = `${currentPage}/${totalPages}`;
    pagination.appendChild(info);
  }

/* 
   การจัดการ Modal และ Popup UI Interaction
   เปิด/ปิด หน้าต่างสร้างโพสต์, หน้าต่างจัดการ, และ Popup ติดต่อ
*/

// ปุ่ม "ประกาศใหม่"  เปิด Modal
openBtn.addEventListener("click", () => {
  modal.style.display = "flex";
  form.reset();
  form.dataset.editing = "false";
  form.querySelector('button[type="submit"]').textContent = "โพสต์";
});

// ปุ่ม "ยกเลิก"  ปิด Modal
closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
  form.reset();
  form.dataset.editing = "false";
});

// คลิกพื้นที่ว่างนอก Modal  ปิด Modal
// window.addEventListener("click", (e) => {
//   if (e.target === modal) {
//     modal.style.display = "none";
//     form.reset();
//     form.dataset.editing = "false";
//   }
// });

// ฟังก์ชันแสดง Popup ข้อมูลติดต่อ
function showContactPopup(contactInfo) {
  const oldPopup = document.querySelector('.contact-popup');
  if (oldPopup) oldPopup.remove();
  
  const popup = document.createElement('div');
  popup.className = 'contact-popup';
  popup.style.display = 'flex';
  popup.innerHTML = `
    <div class="contact-popup-content">
      <h3>ช่องทางติดต่อ</h3>
      <p>${contactInfo || 'ไม่มีข้อมูลติดต่อ'}</p>
      <button class="close-contact-btn">ปิด</button>
    </div>
  `;
  document.body.appendChild(popup);
  setTimeout(() => { popup.style.opacity = '1'; }, 10);
  const closeBtnPopup = popup.querySelector('.close-contact-btn');
  closeBtnPopup.addEventListener('click', () => {
    popup.style.opacity = '0';
    setTimeout(() => popup.remove(), 200);
  });
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 200);
    }
  });
}

// ฟังก์ชันเปิด Modal จัดการ เมื่อกดปุ่ม Manage บนการ์ด
function openManageModal(card) {
  if (!card) return;
  
  const title = card.querySelector("h3").textContent;
  const tags = card.querySelectorAll(".tags span");
  const locationText = card.querySelector(".info p:nth-of-type(1)")?.textContent || "";
  const location = locationText.replace("สถานที่: ", "").trim();
  const dateText = card.querySelector(".info p:nth-of-type(2)")?.textContent || "";
  const date = dateText.replace("วันที่: ", "").replace(" | เวลา: ", " ");
  
  // เติมข้อมูลลงใน Modal จัดการ
  document.getElementById("manageTitle").textContent = title;
  document.getElementById("manageCategory").textContent = tags[0]?.textContent || "";
  document.getElementById("manageLocation").textContent = location;
  document.getElementById("manageDate").textContent = date;
  manageModal.style.display = "flex";
}

// ปิด Modal จัดการ
closeManage.addEventListener("click", () => {
  manageModal.style.display = "none";
});

// ปุ่ม "เปลี่ยนเป็นส่งคืนแล้ว"
markReturned.addEventListener("click", async () => {
  if (!currentPostCard) return;
  
  const statusEl = currentPostCard.querySelector(".status");
  const id = currentPostCard.dataset.id;
  
  // อัปเดตหน้าจอ
  statusEl.textContent = "ส่งคืนแล้ว";
  statusEl.style.background = "#cce7ff";
  statusEl.style.color = "#004085";
  currentPostCard.classList.remove("found", "lost");
  currentPostCard.classList.add("returned");
  currentPostCard.dataset.status = "returned"; // เก็บเป็น eng
  manageModal.style.display = "none";
  
  // อัปเดตลงฐานข้อมูล Firebase 
  if (id) {
    try {
      await updateDoc(doc(db, "posts", id), { status: "returned" });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  }
});
// ปุ่ม "ลบประกาศ"
deleteBtn.addEventListener("click", async () => {
  if (!currentPostCard) return;

  // Safety Check
  const result = await Swal.fire({
    title: 'ยืนยันการลบ?',
    text: "คุณต้องการลบประกาศนี้ถาวรใช่หรือไม่?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33', 
    cancelButtonColor: '#3085d6', 
    confirmButtonText: 'ตกลง',
    cancelButtonText: 'ยกเลิก'
  });

  // ถ้าผู้ใช้กด "ยกเลิก" ให้หยุดทำงานทันที (ไม่ลบ)
  if (!result.isConfirmed) return;

  const id = currentPostCard.dataset.id;

  // ลบออกจากหน้าจอทันที (UI Update)
  currentPostCard.remove();
  manageModal.style.display = "none";
  filterPosts(); // จัดเรียงหน้าใหม่

  // ลบออกจากฐานข้อมูล Firebase
  if (id) {
    try {
      await deleteDoc(doc(db, "posts", id));      
      Swal.fire({
        icon: 'success',
        title: 'ลบสำเร็จ!',
        text: 'ประกาศของคุณถูกลบเรียบร้อยแล้ว',
        showConfirmButton: false, 
        timer: 1500 // 
      });

    } catch (err) {
      console.error("Error deleting:", err);
      // แจ้งเตือนถ้าลบไม่สำเร็จ
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถลบข้อมูลได้ในขณะนี้',
        confirmButtonText: 'ตกลง'
      });
    }
  }
});

// ปุ่ม "แก้ไข"  เปิดฟอร์มพร้อมข้อมูลเดิม
editBtn.addEventListener("click", () => {
  if (!currentPostCard) return;
  
  // ดึงข้อมูลจาก Dataset ของการ์ด
  const title = currentPostCard.querySelector("h3")?.textContent || "";
  const type = currentPostCard.dataset.type || "lost";
  const category = currentPostCard.querySelector(".tags span:nth-of-type(1)")?.textContent || "";
  const location = currentPostCard.dataset.location || "";
  const contact = currentPostCard.dataset.contact || "";
  const detail = currentPostCard.dataset.detail || "";
  const imgSrc = currentPostCard.querySelector(".thumb img")?.src || "";
  const id = currentPostCard.dataset.id || "";
  const date = currentPostCard.dataset.date || "";
  
  // สลับหน้า Modal
  modal.style.display = "flex";
  manageModal.style.display = "none";
  
  // เติมข้อมูลลงฟอร์ม
  form.postTitle.value = title;
  form.postType.value = type;
  form.postCategory.value = reverseCategory(category);
  form.postLocation.value = location;
  form.postDate.value = formatDateForInput(date);
  form.postDetail.value = detail;
  form.postContact.value = contact;
  
  // ตั้งค่าสถานะฟอร์มเป็น "กำลังแก้ไข"
  form.dataset.editing = "true";
  form.dataset.targetId = id;
  form.dataset.oldImage = imgSrc;
  form.dataset.status = currentPostCard.dataset.status || "";
  form.querySelector('button[type="submit"]').textContent = "บันทึกการแก้ไข";
});

/* 
   การทำงาน Firebase Database Logic
   โหลดข้อมูล, บันทึกข้อมูลใหม่, และอัปเดตข้อมูล
*/

// ฟังก์ชันโหลดข้อมูลทั้งหมดจาก Firebase
async function loadPostsFromFirebase() {
  list.innerHTML = ""; // เคลียร์รายการเก่า
  try {
    const querySnapshot = await getDocs(collection(db, "posts"));
    querySnapshot.forEach((docSnap) => {
      const post = docSnap.data();
      post.id = docSnap.id;
      addPostToList(post);
    });
    filterPosts(); // เรียกใช้ Filter เพื่อเรียงลำดับ
  } catch (err) {
    console.error("Error loading posts:", err);
  }
}

// เรียกใช้งานทันทีเมื่อเปิดเว็บ
await loadPostsFromFirebase();

// ฟังก์ชันจัดการเมื่อกด Submit ฟอร์ม (ทั้งสร้างและแก้ไข)
form.addEventListener("submit", async (e) => {
  e.preventDefault(); // ห้ามรีเฟรชหน้า
  
  // Variable ป้องกันการกดปุ่มซ้ำ Double Submit Protection
  if (isSubmitting) return;
  isSubmitting = true;
  
  // เปลี่ยนปุ่มเป็นสถานะกำลังโหลด
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "กำลังบันทึก...";
  submitBtn.disabled = true;
  
  try {
    // ดึงค่าจากฟอร์ม
    const title = form.postTitle.value.trim();
    const type = form.postType.value;
    const category = form.postCategory.value;
    const location = form.postLocation.value.trim();
    const date = form.postDate.value;
    const detail = form.postDetail.value.trim();
    const contact = form.postContact.value.trim();
    const imageFile = form.postImage.files[0];
    
    // เตรียมตัวแปรสำหรับตรวจสอบสถานะ
    const isEditing = form.dataset.editing === "true";
    const targetId = form.dataset.targetId;
    const oldImage = form.dataset.oldImage;

    // 1. เช็คข้อมูลข้อความเบื้องต้น Text Validation
    if (!title || !type || !category || !location || !date || !contact) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#f39c12'
      });
      throw new Error("Incomplete data"); 
    }

    // 2. เช็ครูปภาพ Image Validation
    // เงื่อนไข ถ้าไม่ใช่การแก้ไข สร้างใหม่ และ ไม่มีไฟล์รูป
    if (!isEditing && !imageFile) {
        Swal.fire({
          icon: 'warning',
          title: 'ขาดรูปภาพ',
          text: 'กรุณาอัปโหลดรูปภาพ',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#f39c12'
        });
        throw new Error("Image missing"); 
    }
    
    // ให้สถานะ status เท่ากับ ประเภท type ที่เลือกในฟอร์มเสมอ
    const status = type; 
    // อัปโหลดรูปภาพ ถ้ามีรูปใหม่ ถ้าไม่มีใช้รูปเดิม
    let imageUrl = oldImage || "";
    if (imageFile) {
      imageUrl = await uploadImageToCloudinary(imageFile);
      if (!imageUrl) throw new Error("Image upload failed");
    }
    
    // สร้าง Object ข้อมูลโพสต์
    const postData = {
      title,
      type,
      category,
      location,
      date,
      detail,
      contact,
      image: imageUrl,
      status: status
    };
    
    // บันทึกสำเร็จ Success
    if (isEditing && targetId) {
      // กรณีแก้ไข Update Post
      await updateDoc(doc(db, "posts", targetId), postData);
      postData.id = targetId;
      updatePostInUI(targetId, postData);
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: 'แก้ไขโพสต์เรียบร้อยแล้ว',
        showConfirmButton: false,
        timer: 2000
      });

    } else {
      // กรณีสร้างใหม่ Create Post
      postData.createdAt = new Date().toISOString(); // เพิ่มเวลาที่สร้าง
      const docRef = await addDoc(collection(db, "posts"), postData);
      postData.id = docRef.id;
      addPostToList(postData);
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: 'ลงประกาศเรียบร้อยแล้ว',
        showConfirmButton: false,
        timer: 2000
      });
    }
    
    // รีเซ็ตฟอร์มและปิด Modal
    form.reset();
    form.dataset.editing = "false";
    modal.style.display = "none";
    
  } catch (error) {
    // จัดการ Error Error Handling
    // เงื่อนไข: ไม่ต้องโชว์ Error ซ้ำ ถ้าเป็นเคสข้อมูลไม่ครบ หรือ รูปหาย
    if (error.message !== "Incomplete data" && error.message !== "Image missing") {
      console.error("Error submitting post:", error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด!',
        text: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#d33'
      });
    }
  } finally {
    // คืนค่าปุ่มให้กดได้อีกครั้งเสมอ (ไม่ว่าจะ error หรือสำเร็จ)
    isSubmitting = false;
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});
/* 
   การแสดงผลหน้าเว็บ UI Rendering Logic
   สร้าง HTML Card และอัปเดตข้อมูลบนหน้าจอ */
// ฟังก์ชันสร้าง Card และนำไปใส่ใน List
function addPostToList(post) {
  const card = document.createElement("div");
  card.className = `card ${post.type}`;
  // เก็บข้อมูลดิบลงใน Dataset เพื่อให้ JS ดึงไปใช้ตอนแก้ไข/ทำให้กรองข้อมูลได้ง่าย
  card.dataset.id = post.id || "";
  card.dataset.date = post.date || "";
  card.dataset.contact = post.contact || "";
  card.dataset.type = post.type || "";
  card.dataset.category = post.category || "";
  card.dataset.location = post.location || "";
  card.dataset.detail = post.detail || "";
  card.dataset.status = post.status || "";
  
  // ข้อความสถานะ ภาษาไทย
  let statusText = "";
  if (post.status === "returned") {
      statusText = "ส่งคืนแล้ว";
  } else {
      statusText = post.type === "found" ? "พบของ" : "ของหาย";
  }
  
  // จัดรูปแบบวันที่และเวลา
  let dateStr = "-";
  let timeStr = "-";
  if (post.date) {
    const dateObj = new Date(post.date);
    if (!isNaN(dateObj)) {
      dateStr = dateObj.toLocaleDateString("th-TH", {
        year: "numeric", month: "short", day: "numeric",
      });
      timeStr = dateObj.toLocaleTimeString("th-TH", {
        hour: "2-digit", minute: "2-digit",
      });
    }
  }
  
  // สร้าง HTML ภายใน Card
  card.innerHTML = `
    <div class="thumb"><img src="${post.image || 'img/default.jpg'}" alt="${post.title}"></div>
    <div class="info">
      <div class="status">${statusText}</div>
      <h3>${post.title}</h3>
      <p>สถานที่: ${post.location || "ไม่ระบุสถานที่"}</p>
      <p>วันที่: ${dateStr} | เวลา: ${timeStr}</p>
      <div class="tags">
        <span>${mapCategory(post.category)}</span>
        <span>${post.type === "found" ? "มีผู้เก็บได้" : "กำลังตามหา"}</span>
      </div>
      <p>รายละเอียดเพิ่มเติม: ${post.detail || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
      <div class="actions">
        <button class="btns btn-primarys contact-btn">ติดต่อ</button>
        <button class="btns btn-outlines manage-btn">จัดการ</button>
      </div>
    </div>
  `;
  
  // กำหนดสีพื้นหลังตามสถานะ เขียว/แดง/ฟ้า
  const statusEl = card.querySelector(".status");
  if (statusText === "ส่งคืนแล้ว") {
    statusEl.style.background = "#cce7ff";
    statusEl.style.color = "#004085";
    card.dataset.status = "returned";
  } else if (post.type === "found") {
    statusEl.style.background = "#c9f4ea";
    statusEl.style.color = "#047857";
    card.dataset.status = "found";
  } else if (post.type === "lost") {
    statusEl.style.background = "#fde4ec";
    statusEl.style.color = "#b91c1c";
    card.dataset.status = "lost";
  }
  
  // เพิ่ม Card ลงในรายการ ขึ้นต้นรายการขหรืออันแรกนั่นแหละ
  list.prepend(card);
  
  //  เรียงลำดับทันที Smart Sort
  const allCards = Array.from(list.querySelectorAll(".card"));
  allCards.forEach(c => c.classList.remove("paginated-hidden"));
  allCards.sort((a, b) => new Date(b.dataset.date) - new Date(a.dataset.date));
  allCards.forEach(c => list.appendChild(c));
  
  showPage(currentPage); // โชว์หน้าที่โพสต์
}

// ฟังก์ชันอัปเดตข้อมูลบน Card เดิม ใช้ตอนแก้ไข Card
function updatePostInUI(targetId, post) {
  const cards = list.querySelectorAll(".card");
  
  cards.forEach((card) => {
    if (card.dataset.id === targetId) {
      const statusEl = card.querySelector(".status");
      
      // อัปเดตข้อมูลใน Dataset
      card.className = `card ${post.type}`;
      card.dataset.type = post.type;
      card.dataset.category = post.category;
      card.dataset.location = post.location;
      card.dataset.detail = post.detail;
      card.dataset.contact = post.contact;
      card.dataset.date = post.date;
      card.dataset.status = post.status === "returned" ? "returned" : post.type;
      
      // อัปเดตข้อความสถานะ 
      if (post.status === "returned") {
          statusEl.textContent = "ส่งคืนแล้ว";
          statusEl.style.background = "#cce7ff";
          statusEl.style.color = "#004085";
      } else {
          statusEl.textContent = post.type === "found" ? "พบของ" : "ของหาย";
          if (post.type === "found") {
            statusEl.style.background = "#c9f4ea";
            statusEl.style.color = "#047857";
          } else {
            statusEl.style.background = "#fde4ec";
            statusEl.style.color = "#b91c1c";
          }
      }
      
      // อัปเดตรูปภาพและข้อความอื่นๆ
      const img = card.querySelector(".thumb img");
      if (img) img.src = post.image || "img/default.jpg";
      
      const h3 = card.querySelector("h3");
      if (h3) h3.textContent = post.title;
      
      let dateStr = "-";
      let timeStr = "-";
      if (post.date) {
        const dateObj = new Date(post.date);
        if (!isNaN(dateObj)) {
          dateStr = dateObj.toLocaleDateString("th-TH", {
            year: "numeric", month: "short", day: "numeric"
          });
          timeStr = dateObj.toLocaleTimeString("th-TH", {
            hour: "2-digit", minute: "2-digit"
          });
        }
      }
      
      const p1 = card.querySelector(".info p:nth-of-type(1)");
      const p2 = card.querySelector(".info p:nth-of-type(2)");
      const tag1 = card.querySelector(".tags span:nth-of-type(1)");
      const tag2 = card.querySelector(".tags span:nth-of-type(2)");
      
      if (p1) p1.textContent = `สถานที่: ${post.location}`;
      if (p2) p2.textContent = `วันที่: ${dateStr} | เวลา: ${timeStr}`;
      if (tag1) tag1.textContent = mapCategory(post.category);
      if (tag2) tag2.textContent = post.type === "found" ? "มีผู้เก็บได้" : "กำลังตามหา";
      
      const detailEl = Array.from(card.querySelectorAll(".info p"))
        .find(p => p.textContent.trim().startsWith("รายละเอียดเพิ่มเติม:"));
      
      if (detailEl) {
        detailEl.textContent = `รายละเอียดเพิ่มเติม: ${post.detail || "ไม่มีรายละเอียดเพิ่มเติม"}`;
      }
    }
  });
}

/* 
   ระบบค้นหาและกรองข้อมูล Search & Filter Logic
   กรองตามคำค้นหา, หมวดหมู่, สถานะ, และเวลา
*/

// ฟังก์ชันกรองข้อมูลหลัก
function filterPosts() {
  const searchValue = searchInput?.value.trim().toLowerCase() || "";
  const categoryValue = categorySelect?.value || "";
  const statusValue = statusSelect?.value || "";
  const timeValue = timeSelect?.value || "";
  
  let cards = Array.from(document.querySelectorAll(".card"));
  
  // เรียงลำดับตามเวลา ใหม่สุด/เก่าสุด
  if (timeValue === "oldest") {
    cards.sort((a, b) => new Date(a.dataset.date) - new Date(b.dataset.date));
  } else {
    cards.sort((a, b) => new Date(b.dataset.date) - new Date(a.dataset.date));
  }
  
  // จัดเรียง DOM ใหม่ตามผลลัพธ์การ Sort
  cards.forEach(card => list.appendChild(card));
  
  // ตรวจสอบเงื่อนไขการกรองทีละการ์ด
  cards.forEach((card) => {
    const title = card.querySelector("h3")?.textContent.toLowerCase() || "";
    const detail = card.dataset.detail?.toLowerCase() || "";
    const location = card.dataset.location?.toLowerCase() || "";
    const categoryText = card.querySelector(".tags span:nth-of-type(1)")?.textContent.toLowerCase() || "";
    const statusText = card.querySelector(".status")?.textContent.toLowerCase() || "";
    const cardCategory = card.dataset.category || "";
    const cardStatus = card.dataset.status || "";
    
    let visible = true;
    
    // ค้นหาจากช่อง Search หาในชื่อ, รายละเอียด, สถานที่, อื่นๆ
    if (searchValue) {
      const matchesSearch = 
        title.includes(searchValue) || 
        detail.includes(searchValue) || 
        location.includes(searchValue) || 
        categoryText.includes(searchValue) || 
        statusText.includes(searchValue); 
      
      if (!matchesSearch) {
        visible = false;
      }
    }
    
    // กรองตามหมวดหมู่
    if (categoryValue && categoryValue !== "" && cardCategory !== categoryValue) {
      visible = false;
    }
    
    // กรองตามสถานะ
    if (statusValue && statusValue !== "") {
      if (statusValue !== cardStatus) {
        visible = false;
      }
    }
    
    // แสดง/ซ่อน การ์ด
    card.style.display = visible ? "" : "none";
    card.classList.remove('paginated-hidden');
  });
  
  currentPage = 1;
  showPage(1);
}

// ผูก Event กับตัวกรองต่างๆ
if (categorySelect) categorySelect.addEventListener("change", filterPosts);
if (statusSelect) statusSelect.addEventListener("change", filterPosts);
if (timeSelect) timeSelect.addEventListener("change", filterPosts);

// ใช้ Debounce ทำงานDlay ค้นหา3วิ
if (searchInput) {
  searchInput.addEventListener("input", debounce(filterPosts, 300));
}

// ใช้ Event Delegation ดักจับการคลิกปุ่มในการ์ด ติดต่อ/จัดการ
list.addEventListener("click", (e) => {
  // ปุ่มติดต่อ
  if (e.target.classList.contains("contact-btn")) {
    const card = e.target.closest(".card");
    const contact = card.dataset.contact || "ไม่มีข้อมูลติดต่อ";
    showContactPopup(contact);
  }
  
  // ปุ่มจัดการ
  if (e.target.classList.contains("manage-btn")) {
    const card = e.target.closest(".card");
    currentPostCard = card;
    openManageModal(card);
  }
});

console.log("Firebase + Cloudinary Config successfully");
});

