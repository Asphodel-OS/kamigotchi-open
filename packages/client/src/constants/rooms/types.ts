// shows something only once the account has (or hasn't yet) completed a quest
export interface QuestGate {
  after?: number; // quest index that must be complete
  before?: number; // quest index that must not be complete
}

// represents the configuration of a visual media asset in a room
export interface RoomAsset {
  name: string;
  coordinates?: { x1: number; y1: number; x2: number; y2: number };
  dialogue?: number;
  onClick?: React.MouseEventHandler<HTMLDivElement>; // TODO: wipe this in favor of inputs
  quest?: QuestGate;
}

// represents the music in a room
interface Music {
  key: string;
  path: string;
}

// represents a room in all its glory
export interface Room {
  index: number;
  backgrounds: string[];
  questBackgrounds?: { after: number; backgrounds: string[] }; // replace backgrounds once a quest is complete
  objects: RoomAsset[];
  music?: Music;
}
