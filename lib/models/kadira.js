export default class KadiraModel {
  _getDateId(timestamp) {
    const remainder = timestamp % (1000 * 60);
    const dateId = timestamp - remainder;
    return dateId;
  }
}
