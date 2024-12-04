import { MovieMedia, ShowMedia } from './media';

export interface Context {
  proxiedFetch: (url: string, options?: any) => Promise<Response>;
}

export interface MovieScrapeContext extends Context {
  media: MovieMedia;
}

export interface ShowScrapeContext extends Context {
  media: ShowMedia;
}

export interface SourcererOutput {
  stream: Array<{
    id: string;
    type: 'file';
    quality: string;
    url: string;
    flags: string[];
  }>;
  embeds: Array<{
    id: string;
    type: 'embed';
    url: string;
    flags: string[];
  }>;
} 