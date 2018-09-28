import KadiraModel from './kadira';

export default class BaseErrorModel extends KadiraModel{
  constructor() {
    this._filters = [];
  }

  addFilter(filter) {
    if (typeof filter === 'function') {
      this._filters.push(filter);
    } else {
      throw new Error('Error filter must be a function');
    }
  }

  removeFilter(filter) {
    const index = this._filters.indexOf(filter);
    if (index >= 0) {
      this._filters.splice(index, 1);
    }
  }

  applyFilters(type, message, error, subType) {
    return this._filters.every((filter) => {
      try {
        return filter(type, message, error, subType);
      } catch (error) {
        // we need to remove this filter
        // we may ended up in a error cycle
        this.removeFilter(filter);
        throw new Error(`An error thrown from a filter you've suplied: ${ex.message}`);
      }
    });
  }
}
