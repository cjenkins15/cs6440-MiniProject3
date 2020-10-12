/*
*  NOTE: this implementation is publicly available at the below source, and was not written by me. It is being used in this
*  app to improve performance of assembling/using similarity-ranked lists of patients, and does not in itself implement
*  any of the core functionalities of the app.
*
*  SOURCE: User `gyre` at https://stackoverflow.com/questions/42919469/efficient-way-to-implement-priority-queue-in-javascript
*          Dated: March 21 2017
*/

const pq_top = 0;
const pq_parent = i => ((i + 1) >>> 1) - 1;
const pq_left = i => (i << 1) + 1;
const pq_right = i => (i + 1) << 1;

class PriorityQueue {
    constructor(comparator = (a, b) => a > b) {
        this._heap = [];
        this._comparator = comparator;
    }
    size() {
        return this._heap.length;
    }
    isEmpty() {
        return this.size() == 0;
    }
    peek() {
        return this._heap[pq_top];
    }
    push(...values) {
        values.forEach(value => {
            this._heap.push(value);
            this._siftUp();
        });
        return this.size();
    }
    pop() {
        const poppedValue = this.peek();
        const bottom = this.size() - 1;
        if (bottom > pq_top) {
            this._swap(pq_top, bottom);
        }
        this._heap.pop();
        this._siftDown();
        return poppedValue;
    }
    replace(value) {
        const replacedValue = this.peek();
        this._heap[pq_top] = value;
        this._siftDown();
        return replacedValue;
    }
    _greater(i, j) {
        return this._comparator(this._heap[i], this._heap[j]);
    }
    _swap(i, j) {
        [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    }
    _siftUp() {
        let node = this.size() - 1;
        while (node > pq_top && this._greater(node, pq_parent(node))) {
            this._swap(node, pq_parent(node));
            node = pq_parent(node);
        }
    }
    _siftDown() {
        let node = pq_top;
        while (
            (pq_left(node) < this.size() && this._greater(pq_left(node), node)) ||
            (pq_right(node) < this.size() && this._greater(pq_right(node), node))
            ) {
            let maxChild = (pq_right(node) < this.size() && this._greater(pq_right(node), pq_left(node))) ? pq_right(node) : pq_left(node);
            this._swap(node, maxChild);
            node = maxChild;
        }
    }
}