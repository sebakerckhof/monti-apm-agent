export class UniqueId {
  constructor(start = 0) {
    this.id = start;
  }

  get() {
    return '' + this.id++;
  }
}


export const DefaultUniqueId = new UniqueId();