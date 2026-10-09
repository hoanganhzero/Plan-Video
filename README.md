# 🎬 Plan Video – Làm video với Google Flow dễ như ăn kẹo

Công cụ web giúp **bất kỳ ai** lên kịch bản và tạo prompt chuẩn để làm video bằng
[Google Flow](https://labs.google/fx/tools/flow) (công cụ làm phim AI của Google, dùng mô hình Veo):
**phim ngắn, video ca nhạc, phim hoạt hình, nhạc thiếu nhi**, quảng cáo, vlog… Có **âm thanh tiếng Việt chuẩn**
(giọng Bắc/Trung/Nam) và **lồng tiếng Việt cho video nước ngoài**.

Không cần cài đặt, không cần biết viết prompt, không cần biết code.

## Cách dùng (5 bước)

1. **Ý tưởng** – Chọn loại video (phim ngắn, video ca nhạc, phim hoạt hình, nhạc thiếu nhi, quảng cáo, vlog, quán ăn, giáo dục, tự do), chọn giọng tiếng Việt và viết một câu ý tưởng – hoặc bấm một **gợi ý có sẵn**.
2. **Kịch bản** – Ứng dụng chia video thành các cảnh ~8 giây (đúng độ dài một clip của Flow). Sửa, thêm, nhân đôi, xoá, đổi thứ tự cảnh tuỳ ý.
3. **Prompt** – Bấm **Sao chép** từng cảnh → dán vào Flow → tạo → tải clip đẹp nhất về → tick **Đã tạo xong** để theo dõi tiến độ.
4. **Ghép phim** – Chọn tất cả clip đã tải → thêm tiêu đề, phụ đề tiếng Việt, nhạc nền, hiệu ứng chuyển cảnh → **Xuất video**.
5. **Lồng tiếng** (tuỳ chọn) – Thêm giọng đọc tiếng Việt chuẩn, hoặc lồng tiếng Việt cho video nước ngoài.

### Điểm hay

- ✅ Prompt viết theo cấu trúc Veo khuyến nghị: góc máy → hành động → bối cảnh → ánh sáng → phong cách → âm thanh → lời thoại.
- ✅ **Giữ nhân vật nhất quán**: mô tả nhân vật được lặp lại y hệt trong mọi cảnh.
- ✅ **Tiếng Việt chuẩn**: mỗi cảnh chọn *Lời thoại / Thuyết minh / Hát*; prompt ghi rõ cho Veo nói hoặc hát tiếng Việt với giọng Bắc, Trung hay Nam.
- ✅ **Mẫu theo thể loại** tự chọn sẵn phong cách: MV (intro → verse → điệp khúc → outro), hoạt hình 3D, nhạc thiếu nhi (hoạt hình 2D an toàn cho bé)…
- ✅ Chọn phong cách (điện ảnh, anime, hoạt hình 3D…), cảm xúc, khung hình 16:9 / 9:16.
- ✅ **Nhiều dự án**: tab 📁 Dự án để mở, nhân bản, xoá; mọi thứ tự lưu trong trình duyệt; xuất/nhập `.json` để chuyển máy.
- ✅ **Ảnh tham chiếu**: prompt *bảng nhân vật* (dùng với Ingredients to Video) và *ảnh khung đầu* từng cảnh (Frames to Video) để nhân vật giống nhau xuyên suốt.
- ✅ **Theo dõi tiến độ**: tick từng cảnh đã tạo trong Flow.
- ✅ **Đăng mạng xã hội**: tiêu đề, mô tả YouTube, chú thích TikTok và hashtag (tạo nhanh hoặc nhờ AI viết).
- ✅ **Cài như app** trên điện thoại (PWA), mở được cả khi mất mạng.
- ✨ **Chế độ AI (tuỳ chọn)**: nhập [Gemini API key miễn phí](https://aistudio.google.com/apikey) để AI tự viết kịch bản, lời thoại và **lời bài hát tiếng Việt** từ ý tưởng. Key chỉ lưu trong trình duyệt của bạn và gửi thẳng tới Google.

## 🎞️ Ghép phim

Tab **4. Ghép phim** ghép các clip 8 giây tải từ Flow thành một video hoàn chỉnh, ngay trong trình duyệt:

- Chọn nhiều clip cùng lúc (tự sắp theo tên file 01, 02, 03…), đổi thứ tự, **cắt bớt đầu/cuối** từng clip.
- Khung hình **16:9, 9:16 hoặc 1:1** (tự cắt cho vừa, không méo hình).
- **Tiêu đề mở đầu**, **phụ đề tiếng Việt** lấy từ lời thoại/lời hát trong kịch bản hoặc từ file `.srt`.
- **Nhạc nền** (tự lặp, nhỏ dần ở cuối), chỉnh âm lượng nhạc và tiếng trong clip, hiệu ứng **mờ dần** khi chuyển cảnh.
- Xem trước, xuất video (MP4 khi trình duyệt hỗ trợ H.264, nếu không thì WebM), tải phụ đề `.srt`.

> Video được dựng theo thời gian thực nên mất thời gian bằng độ dài phim; hãy giữ tab mở khi xuất. Nên dùng Chrome/Edge trên máy tính.

## 🎙️ Lồng tiếng Việt

Tab **Lồng tiếng Việt** (cần Gemini API key):

1. **Video nước ngoài** (Anh, Trung, Hàn, Nhật, Thái…): chọn video → *Nhận dạng & dịch*. AI nghe lời nói, ghi thời gian từng câu, nhận biết người nói và dịch sang tiếng Việt tự nhiên (xưng hô anh/em, tôi/bạn… theo ngữ cảnh).
2. Sửa câu dịch, chọn giọng cho từng người nói (nam/nữ), chọn giọng Bắc/Trung/Nam → *Tạo giọng lồng tiếng* (Gemini TTS).
3. Chỉnh âm lượng tiếng gốc (nhạc nền), *Nghe thử*, rồi xuất:
   - **Video lồng tiếng** ngay trong trình duyệt (MP4 trên Chrome có H.264, nếu không thì WebM),
   - **Giọng lồng tiếng .wav** và **phụ đề tiếng Việt .srt** để ghép trong CapCut,
   - hoặc lệnh **ffmpeg** có sẵn để xuất MP4 chất lượng gốc kèm phụ đề.

**Giọng đọc chuẩn cho video làm bằng Flow:** ở bước 3 bấm *Tạo giọng đọc tiếng Việt cho kịch bản* → lời thoại/thuyết minh được đặt đúng thời điểm từng cảnh (8 giây/cảnh) → chọn video đã ghép từ Flow → xuất. Cách này cho giọng rõ hơn khi Veo phát âm tiếng Việt chưa chuẩn.

> Lưu ý: tiếng gốc chỉ được giảm nhỏ, không tách riêng được giọng khỏi nhạc nền. Câu dịch dài hơn thời gian gốc sẽ được báo ⚠ để rút gọn. Chỉ lồng tiếng video bạn có quyền sử dụng.

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
index.html              Giao diện các bước + hướng dẫn Flow
manifest.webmanifest    Khai báo cài như app (PWA)
sw.js                   Service worker: mở nhanh, dùng khi mất mạng
icons/                  Biểu tượng ứng dụng
css/style.css           Giao diện (hỗ trợ điện thoại & chế độ tối)
js/templates.js         Các mẫu video, phong cách, cảm xúc
js/prompt-builder.js    Tạo prompt chuẩn Flow/Veo từ kịch bản
js/gemini.js            Gemini API: viết kịch bản, nhận dạng + dịch video, đọc giọng (TTS)
js/dubbing.js           Logic lồng tiếng: phụ đề SRT, xếp lịch giọng đọc, mã hoá WAV
js/dub-ui.js            Tab Lồng tiếng: ghép âm thanh, nghe thử, xuất video
js/app.js               Bước 1–3, dự án, mạng xã hội
js/projects.js          Thư viện nhiều dự án (lưu trong trình duyệt)
js/social.js            Tiêu đề / mô tả / hashtag khi không dùng AI
js/montage.js           Logic ghép phim: dòng thời gian, phụ đề, chuyển cảnh
js/montage-ui.js        Tab Ghép phim: vẽ khung hình, trộn âm thanh, xuất video
js/ui-utils.js          Tiện ích giao diện dùng chung
tests/                  Kiểm thử (npm test)
```

### Thêm mẫu video mới

Mở `js/templates.js` và thêm một mục vào `TEMPLATES` (kèm `ideas` là các gợi ý ý tưởng), mỗi `beat` là một cảnh:

```js
{ title: 'Tên cảnh', goal: 'Gợi ý cho người dùng', camera: 'Close-up', action: 'Mô tả, dùng {idea} để chèn ý tưởng',
  voiceType: 'sing', dialogue: 'Lời mẫu (không bắt buộc)' }
```

## Mẹo làm video đẹp với Flow

- Mỗi prompt chỉ **một cảnh quay, một hành động chính**.
- **Video ca nhạc / nhạc thiếu nhi**: Flow chỉ tạo 8 giây mỗi lần, nên dùng bài hát hoàn chỉnh (tự thu hoặc từ công cụ làm nhạc) rồi ghép với các clip Flow trong CapCut.
- Phần hình ảnh viết bằng **tiếng Anh** cho kết quả tốt nhất; lời thoại có thể bằng tiếng Việt.
- Dùng **Ingredients to Video** (tải ảnh nhân vật/sản phẩm) để giữ hình ảnh đồng nhất hơn nữa.
- Dùng **Frames to Video** nếu bạn có ảnh sản phẩm thật.
- Dùng **Extend** trong Scenebuilder để kéo dài cảnh liền mạch.

## Lưu ý

Google Flow chưa có API công khai, nên ứng dụng tạo prompt để bạn dán vào Flow chứ không tự động điều khiển Flow.
Cần tài khoản Google; số lượt tạo video phụ thuộc gói Google AI của bạn. Gemini API miễn phí có giới hạn lượt/phút;
ứng dụng tự đợi và thử lại khi bị giới hạn. Video lớn hơn 15 MB được tải lên qua Gemini File API.

> Khi sửa file trong `js/` hoặc `css/`, hãy tăng `VERSION` trong `sw.js` để người dùng nhận bản mới.
