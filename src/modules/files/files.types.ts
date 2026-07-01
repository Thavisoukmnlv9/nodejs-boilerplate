export interface FileView {
  id: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  url: string;
  created_at: string;
}
