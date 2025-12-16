import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true // เปิดให้เข้าผ่าน IP ในวง LAN ได้ (สำคัญสำหรับทดสอบบนมือถือ)
  }
})