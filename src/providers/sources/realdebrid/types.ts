export interface JackettResult {
  Title: string;
  Link: string;
  MagnetUri: string;
  Size: number;
  Seeders: number;
  PublishDate: string;
}

export interface RealDebridTorrent {
  id: string;
  filename: string;
  hash: string;
  bytes: number;
  links: string[];
  status: string;
}

export interface RealDebridStream {
  id: number;
  filename: string;
  mimeType: string;
  filesize: number;
  link: string;
  host: string;
  quality: string;
} 