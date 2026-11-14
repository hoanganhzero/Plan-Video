# 🎬 Plan Video – Làm video với Google Flow dễ như ăn kẹo

Công cụ web giúp **bất kỳ ai** lên kịch bản và tạo prompt chuẩn để làm video bằng
[Google Flow](https://labs.google/fx/tools/flow) (công cụ làm phim AI của Google, dùng mô hình Veo):
**phim ngắn, video ca nhạc, phim hoạt hình, nhạc thiếu nhi**, quảng cáo, vlog… Có **âm thanh tiếng Việt chuẩn**
(giọng Bắc/Trung/Nam) và **lồng tiếng Việt cho video nước ngoài**.

Không cần cài đặt, không cần biết viết prompt, không cần biết code.

## ⚡ Tạo nhanh – chỉ cần ảnh + ý tưởng

Tab **⚡ Tạo nhanh** (màn hình đầu tiên): tải **ảnh khuôn mặt/dáng người** và **ảnh sản phẩm**, viết ý tưởng, rồi chọn:

| | 🆓 Làm trong Flow | 🚀 Tự động hoàn toàn |
|---|---|---|
| Chi phí | Dùng tín dụng gói Google AI Pro | Phí Gemini API theo giây video (cần bật billing) |
| Bạn làm gì | Tải 2 ảnh lên Flow (*Ingredients to Video*), dán prompt từng cảnh | Bấm 1 nút, chờ vài phút |
| Kết quả | Kịch bản + prompt giữ đúng người & sản phẩm | Video quảng cáo hoàn chỉnh có tiêu đề, phụ đề tiếng Việt |

Chế độ tự động: AI xem ảnh và viết kịch bản → tạo **ảnh khung đầu** mỗi cảnh có đúng người + sản phẩm → **Veo** biến ảnh thành clip 8 giây có tiếng → tự **ghép phim** và tải video về.

- Bấm **🔍 Kiểm tra key & chọn model**: ứng dụng hỏi Google xem key dùng được model video/ảnh nào và tự chọn (Google đổi tên model khá thường xuyên).
- Trước khi tạo, ứng dụng báo **chi phí ước tính** và hỏi lại. Giá tham khảo (9/2026): Veo 3.1 Fast ~0,10–0,12 USD/giây, Veo 3.1 ~0,40 USD/giây – kiểm tra trang giá chính thức của Google.
- Cảnh lỗi có nút **Thử lại**; nếu trình duyệt không tải được video trực tiếp, ứng dụng đưa link để tải thủ công rồi thêm ở tab Ghép phim.
- Ảnh được gửi tới Google để tạo video. Chỉ dùng ảnh của bạn hoặc người đã đồng ý.

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

## 🎣 Trò chơi: Câu Cá Học Giỏi

Trò chơi vừa học vừa chơi trong thư mục `fishing/` – mở `http://localhost:3000/fishing/` sau khi chạy `npm start`.

- **Đồ hoạ 3D** (Three.js/WebGL): mặt nước gợn sóng phản chiếu nắng, người câu đội nón lá trên cầu gỗ, cá 3D bơi dưới nước và giãy trên dây khi kéo lên, nước bắn, camera chuyển động; mỗi khu một cảnh (ao sen, sông tre và nhà sàn lúc hoàng hôn, hồ núi tuyết và rừng thông, biển đảo và hải đăng, vực sâu ban đêm có sinh vật phát sáng). Máy không hỗ trợ WebGL tự chuyển sang cảnh 2D.
- **Cách chơi kiểu game câu cá**: giao diện toàn màn hình (thanh người chơi, menu tròn, nút hành động lớn).
  1. **Giữ** nút 🎣 để lấy lực, **thả** để ném – thả trong vùng xanh là *Hoàn hảo* (dễ gặp cá hiếm hơn), ném xa cũng vậy.
  2. Phao chìm → bấm **GIẬT CẦN** trong 1,4 giây, chậm thì cá nhả mồi.
  3. **Kéo cá**: giữ để thu dây, thả khi thanh *căng dây* lên đỏ (căng đỏ quá lâu là đứt dây); cá vùng vẫy thì nên thả bớt.
  4. Tới các mốc khoảng cách, cá vùng vẫy mạnh → **trả lời câu hỏi** có đếm giờ. Đúng: cá yếu đi. Sai: cá kéo ra xa, mất 1 ❤️ độ bền dây (hết ❤️ là cá thoát) và được xem lời giải. Cá Thường/Khá 1 câu, Hiếm/Quý 2 câu, Huyền thoại/Thần thoại 3 câu.
  5. Kéo lên được thì xem thẻ cá: **Cho vào thùng** hoặc **Bán ngay**.
- **Cá giá trị tăng dần**: 6 bậc độ hiếm (Thường → Khá → Hiếm → Quý → Huyền thoại → Thần thoại), 32 loài trải qua 5 khu: Ao làng → Sông quê → Hồ trên núi → Biển xanh → Vực sâu huyền bí. Cá càng hiếm thì câu hỏi càng khó, thời gian càng dài và giá càng cao.
- **Nhiệm vụ**: chuỗi 22 nhiệm vụ (trả lời đúng theo môn, chuỗi đúng liên tiếp, săn cá hiếm, sưu tập loài, lên cấp…) thưởng xu, mồi, vật phẩm, **cần câu mới** và **mở khu câu mới**.
- **🏆 Bảng xếp hạng chung (đua top)**: mỗi học sinh chọn một biệt danh (2–16 ký tự, không cần đăng ký), điểm = tổng KN nhờ trả lời đúng và câu cá, tự gửi sau mỗi lượt câu. Bảng hiện top 50 kèm huy chương 🥇🥈🥉, cấp, số loài, số câu đúng và con cá quý nhất; dòng của mình được tô sáng, có thông báo khi vượt hạng. Máy chủ là Supabase: bảng `fishing_scores` khoá bằng RLS, trình duyệt chỉ gọi 3 hàm `fishing_submit` / `fishing_top` / `fishing_me`; máy chủ chặn điểm giảm hoặc tăng bất thường (> ~600 KN/phút). Cần mở game qua mạng (VD GitHub Pages) để bảng xếp hạng hoạt động; mất mạng vẫn chơi bình thường.
- **🐟 Cá 4D**: mỗi loài có mô hình 3D riêng (dáng, màu, hoa văn, râu, đèn lồng, mũi kiếm…) bơi uốn lượn theo thời gian thực – đuôi và vây vẫy. Xem ở thẻ cá câu được, nút **4D** trong Bộ sưu tập (kéo để xoay, có hào quang theo độ hiếm), và con cá treo trên dây trong cảnh 3D.
- **🗺️ Bản đồ thế giới** minh hoạ: làng – sông – núi – biển – vực sâu nối bằng đường đi, sao ★ theo số loài đã câu, bấm từng khu để xem cá và mở khu.
- **🎒 Trang bị & vật phẩm**: cửa hàng chia tab *Cần câu / Dây câu / Mồi & hỗ trợ* với biểu tượng vẽ riêng và thanh chỉ số. **Dây câu** (cước → dù bện → kevlar → titan) thêm ❤️ độ bền và sức chịu căng. Vật phẩm hỗ trợ bật/tắt ngay trên thanh dưới trước khi ném: 🍀 Bùa may mắn, 🍵 Trà gừng (dây căng chậm 35%), 🥅 Vợt vàng (cá bán giá ×2).
- **⚡ Kỹ năng câu cá** (nút tròn cạnh nút kéo, hoặc phím **E**): mỗi cần câu một kỹ năng, dùng khi đang kéo cá. Mỗi trận có 1 lượt, **mỗi câu trả lời đúng nạp thêm 1 lượt** (tối đa 2). Kỹ năng kéo cá lại gần vẫn phải dừng ở mốc để trả lời câu hỏi.

  | Cần | Kỹ năng | Tác dụng | Hiệu ứng |
  |---|---|---|---|
  | Cần tre | 🌿 Thả dây khéo | Giảm 50% độ căng | Gợn sóng lan, lá xanh bay |
  | Cần sợi thuỷ tinh | 🌊 Sóng xanh | Giảm 70% căng, cá ngừng vùng vẫy | Vòng sóng nước xanh toả rộng |
  | Cần carbon | 🌪️ Lốc xoáy | Cuốn cá lại gần 25% | Lốc gió cuộn dọc dây |
  | Cần vàng | ✨ Ánh vàng | Cá choáng 3 giây | Bùng sáng vàng, vòng hào quang |
  | Cần rồng | 🐉 Rồng cuộn | Kéo gần 35%, xả căng, choáng 2 giây | Cột lửa – nước phun như rồng, rung màn hình |

- **✨ Hiệu ứng theo trang bị**: mỗi cần có vệt sáng riêng khi ném (lửa, vàng, gió…) và kiểu nước bắn riêng khi phao rơi / khi kéo được cá; dây câu hiện đúng màu; mồi vàng làm phao phát sáng, mồi tôm sủi bong bóng; bùa may mắn có hào quang cỏ bốn lá quanh phao, trà gừng toả hơi ấm khi kéo, vợt vàng loé vòng sáng khi cá lên.
- **Hình minh hoạ cá**: 32 loài vẽ vector (SVG) theo phong cách thẻ game, mỗi loài một dáng, màu và hoa văn riêng; cá Huyền thoại/Thần thoại có hào quang.
- **Vật phẩm**: cần câu (tăng may mắn), mồi tôm / mồi vàng, phao gợi ý 50/50, đồng hồ cát +15 giây, bùa may mắn (chắc chắn gặp cá Hiếm trở lên).
- **Môn học**: Toán (sinh tự động theo trình độ Lớp 1–2 / 3–5 / 6–9), Tiếng Việt, Tiếng Anh, Khoa học, Lịch sử & Địa lý, và **Câu hỏi của tôi** – phụ huynh/thầy cô nhập bài cần ôn theo mẫu `Câu hỏi | Đáp án đúng | Sai 1 | Sai 2 | Sai 3`.
- **Sổ ôn tập**: câu trả lời sai được ghi lại kèm đáp án và được hỏi lại sau; trả lời đúng thì xoá khỏi sổ.
- Thùng cá (bán lấy xu), Bộ sưu tập, Cửa hàng; tự lưu trong trình duyệt, xuất/nhập file lưu; chơi được trên điện thoại.

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
js/gemini.js            Gemini API: kịch bản, dịch video, giọng đọc, tạo ảnh, tạo video (Veo)
js/dubbing.js           Logic lồng tiếng: phụ đề SRT, xếp lịch giọng đọc, mã hoá WAV
js/dub-ui.js            Tab Lồng tiếng: ghép âm thanh, nghe thử, xuất video
js/app.js               Bước 1–3, dự án, mạng xã hội
js/projects.js          Thư viện nhiều dự án (lưu trong trình duyệt)
js/social.js            Tiêu đề / mô tả / hashtag khi không dùng AI
js/montage.js           Logic ghép phim: dòng thời gian, phụ đề, chuyển cảnh
js/montage-ui.js        Tab Ghép phim: vẽ khung hình, trộn âm thanh, xuất video
js/auto-video.js        Điều phối tự động: ảnh khung đầu → Veo → tải video, ước tính chi phí
js/auto-ui.js           Tab Tạo nhanh: ảnh người/sản phẩm, Flow hoặc tự động
js/ui-utils.js          Tiện ích giao diện dùng chung
fishing/                Trò chơi Câu Cá Học Giỏi
  js/data.js            Độ hiếm, khu câu, cá, cần câu, vật phẩm, nhiệm vụ
  js/questions.js       Ngân hàng câu hỏi, Toán sinh tự động, câu hỏi riêng
  js/engine.js          Logic trò chơi (thả câu, trả lời, nhiệm vụ, cửa hàng, cấp độ)
  js/fight.js           Mô phỏng pha kéo cá: căng dây, sức cá, khoảng cách, độ bền dây
  js/online.js          Bảng xếp hạng chung (Supabase)
  js/art.js             Hình minh hoạ 32 loài cá dạng SVG
  js/fish3d.js          Cá 4D: mô hình 3D từng loài + chuyển động bơi, khung xem xoay được
  js/icons.js           Biểu tượng vật phẩm, cần câu, dây câu (SVG)
  js/map.js             Bản đồ thế giới minh hoạ (SVG)
  js/scene3d.js         Cảnh câu cá 3D (Three.js): nước, người câu, cá, hiệu ứng, cảnh từng khu
  js/scene.js           Cảnh 2D dự phòng khi máy không có WebGL
  vendor/               Three.js r160 (giấy phép MIT) – để chạy được cả khi mất mạng
  js/main.js            Giao diện trò chơi
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
