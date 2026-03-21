type Props = {
    item: any
}

export default function MediaCard({ item }: Props) {
    const isVideo = item.file_url.includes(".mp4")

    return (
        <div className="rounded-2xl overflow-hidden bg-neutral-900 hover:scale-105 transition">
            {isVideo ? (
                <video src={item.file_url} controls className="w-full h-60 object-cover" />
            ) : (
                <img src={item.file_url} className="w-full h-60 object-cover" />
            )}

            <div className="p-3">
                <p className="text-sm opacity-80">{item.title}</p>
            </div>
        </div>
    )
}