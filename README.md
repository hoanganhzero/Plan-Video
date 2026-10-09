# 🎬 Plan Video – Làm video với Google Flow dễ như ăn kẹo

Công cụ web giúp **bất kỳ ai** lên kịch bản và tạo prompt chuẩn để làm video bằng
[Google Flow](https://labs.google/fx/tools/flow) (công cụ làm phim AI của Google, dùng mô hình Veo).

Không cần cài đặt, không cần biết viết prompt, không cần biết code.

## Cách dùng (3 bước)

1. **Ý tưởng** – Chọn loại video (quảng cáo sản phẩm, vlog du lịch, kể chuyện, quán ăn, giáo dục, tự do) và viết một câu ý tưởng.
2. **Kịch bản** – Ứng dụng chia video thành các cảnh ~8 giây (đúng độ dài một clip của Flow). Bạn sửa, thêm, xoá, đổi thứ tự cảnh tuỳ ý.
3. **Prompt cho Flow** – Bấm **Sao chép** từng cảnh → dán vào Flow (chế độ *Text to Video*) → tạo → chọn clip đẹp nhất → *Add to scene* để ghép thành phim.

### Điểm hay

- ✅ Prompt viết theo cấu trúc Veo khuyến nghị: góc máy → hành động → bối cảnh → ánh sáng → phong cách → âm thanh → lời thoại.
- ✅ **Giữ nhân vật nhất quán**: mô tả nhân vật được lặp lại y hệt trong mọi cảnh.
- ✅ Chọn phong cách (điện ảnh, anime, hoạt hình 3D…), cảm xúc, khung hình 16:9 / 9:16.
- ✅ **Tự lưu** trong trình duyệt; xuất/nhập dự án `.json`, xuất kịch bản `.txt`.
- ✨ **Chế độ AI (tuỳ chọn)**: nhập [Gemini API key miễn phí](https://aistudio.google.com/apikey) để AI tự viết kịch bản chi tiết từ ý tưởng (kể cả ý tưởng viết bằng tiếng Việt). Key chỉ lưu trong trình duyệt của bạn và gửi thẳng tới Google.

## Chạy ứng dụng

Đây là trang web tĩnh (HTML/CSS/JS thuần), không cần build.

```bash
npm start          # mở http://localhost:3000
# hoặc
python3 -m http.server 3000
```

> Phải mở qua web server (không mở trực tiếp file `index.html`) vì ứng dụng dùng ES modules.

### Đưa lên mạng miễn phí

Bật **GitHub Pages** cho repo này (Settings → Pages → Deploy from branch → `main` / root) là có ngay đường link để chia sẻ.

## Cấu trúc

```
index.html              Giao diện 3 bước + hướng dẫn Flow
css/style.css           Giao diện (hỗ trợ điện thoại & chế độ tối)
js/templates.js         Các mẫu video, phong cách, cảm xúc
js/prompt-builder.js    Tạo prompt chuẩn Flow/Veo từ kịch bản
js/gemini.js            Chế độ AI viết kịch bản (Gemini API)
js/app.js               Xử lý giao diện, lưu trữ, sao chép, xuất file
tests/                  Kiểm thử (npm test)
```

### Thêm mẫu video mới

Mở `js/templates.js` và thêm một mục vào `TEMPLATES`, mỗi `beat` là một cảnh:

```js
{ title: 'Tên cảnh', goal: 'Gợi ý cho người dùng', camera: 'Close-up', action: 'Mô tả, dùng {idea} để chèn ý tưởng' }
```

## Mẹo làm video đẹp với Flow

- Mỗi prompt chỉ **một cảnh quay, một hành động chính**.
- Phần hình ảnh viết bằng **tiếng Anh** cho kết quả tốt nhất; lời thoại có thể bằng tiếng Việt.
- Dùng **Ingredients to Video** (tải ảnh nhân vật/sản phẩm) để giữ hình ảnh đồng nhất hơn nữa.
- Dùng **Frames to Video** nếu bạn có ảnh sản phẩm thật.
- Dùng **Extend** trong Scenebuilder để kéo dài cảnh liền mạch.

## Lưu ý

Google Flow chưa có API công khai, nên ứng dụng tạo prompt để bạn dán vào Flow chứ không tự động điều khiển Flow.
Cần tài khoản Google; số lượt tạo video phụ thuộc gói Google AI của bạn.
