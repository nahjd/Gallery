import { useState } from "react"
import { supabase } from "../api/supabase"

export default function UploadForm({ onUpload }: any) {
    const [file, setFile] = useState<File | null>(null)
    const [title, setTitle] = useState("")

    const upload = async () => {
        if (!file) return

        const formData = new FormData()
        formData.append("file", file)
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)

        const res = await fetch(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
            {
                method: "POST",
                body: formData,
            }
        )

        const data = await res.json()

        if (!data.secure_url) {
            alert("Upload error")
            return
        }

        const isVideo = file.type.includes("video")
        const table = isVideo ? "videos" : "images"

        await supabase.from(table).insert({
            title,
            file_url: data.secure_url,
        })

        setFile(null)
        setTitle("")
        onUpload()
    }

    return (
        <div className="bg-neutral-900 p-4 rounded-xl">
            <input
                type="text"
                placeholder="title"
                className="mb-2 w-full p-2 bg-black"
                onChange={(e) => setTitle(e.target.value)}
            />

            <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <button
                onClick={upload}
                className="mt-3 bg-yellow-500 px-4 py-2 rounded"
            >
                Upload
            </button>
        </div>
    )
}