export interface BaseMedia {
  title: string;
  imdbId?: string;
}

export interface MovieMedia extends BaseMedia {
  type: 'movie';
  year: number;
}

export interface ShowMedia extends BaseMedia {
  type: 'show';
  season: number;
  episode: number;
} 