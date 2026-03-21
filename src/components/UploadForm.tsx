import { useState } from "react"
import { supabase } from "../api/supabase"

export default function UploadForm({ onUpload }: any) {
    const [file, setFile] = useState<File | null>(null)
    const [title, setTitle] = useState("")

    const upload = async () => {
        if (!file) return

        const path = `public/${Date.now()}-${file.name}`

        const { data, error } = await supabase.storage
            .from("gallery")
            .upload(path, file)

        if (error) return alert("error")

        const { data: url } = supabase.storage
            .from("gallery")
            .getPublicUrl(data.path)

        const isVideo = file.type.includes("video")

        const table = isVideo ? "videos" : "images"

        await supabase.from(table).insert({
            title,
            file_url: url.publicUrl,
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

            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />

            <button
                onClick={upload}
                className="mt-3 bg-yellow-500 px-4 py-2 rounded"
            >
                Upload
            </button>
        </div>
    )
}