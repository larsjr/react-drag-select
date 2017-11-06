import React from 'react'
import isNull from 'lodash/isNull'
import each from 'lodash/each'
import keys from 'lodash/keys'
import has from 'lodash/has'
import noop from 'lodash/noop'
import PropTypes from 'prop-types'
import {findDOMNode} from 'react-dom'

class Selection extends React.Component {
  static propTypes = {
    enabled: PropTypes.bool,
    onSelectionChange: PropTypes.func,
  }

  /**
   * Component default props
   */
  static defaultProps = {
    enabled: true,
    onSelectionChange: noop,
  }

  /**
   * Component initial state
   */
  state = {
    mouseDown: false,
    startPoint: null,
    endPoint: null,
    selectionBox: null,
    selectedItems: {},
    appendMode: false,
  }

  /**
   * On componentn mount
   */
  componentWillMount() {
    this.selectedChildren = {}
  }

  /**
   * On component props change
   */
  componentWillReceiveProps(nextProps) {
    const nextState = {}
    if (!nextProps.enabled) {
      nextState.selectedItems = {}
    }
    this.setState(nextState)
  }

  /**
   * On component update
   */
  componentDidUpdate() {
    if (this.state.mouseDown && !isNull(this.state.selectionBox)) {
      this._updateCollidingChildren(this.state.selectionBox)
    }
  }

  /**
   * On root element mouse down
   */
  _onMouseDown = e => {
    if (!this.props.enabled || e.button === 2 || e.nativeEvent.which === 2) {
      return
    }
    const nextState = {}
    if (e.ctrlKey || e.altKey || e.shiftKey) {
      nextState.appendMode = true
    }
    nextState.mouseDown = true
    nextState.startPoint = {
      x: e.pageX,
      y: e.pageY,
    }
    this.setState(nextState)
    window.document.addEventListener('mousemove', this._onMouseMove)
    window.document.addEventListener('mouseup', this._onMouseUp)
  }

  /**
   * On document element mouse up
   */
  _onMouseUp = e => {
    window.document.removeEventListener('mousemove', this._onMouseMove)
    window.document.removeEventListener('mouseup', this._onMouseUp)
    this.setState({
      mouseDown: false,
      startPoint: null,
      endPoint: null,
      selectionBox: null,
      appendMode: false,
    })
    this.props.onSelectionChange.call(null, keys(this.selectedChildren))
  }

  /**
   * On document element mouse move
   */
  _onMouseMove = e => {
    e.preventDefault()
    if (this.state.mouseDown) {
      const endPoint = {
        x: e.pageX,
        y: e.pageY,
      }
      this.setState({
        endPoint: endPoint,
        selectionBox: this._calculateSelectionBox(
          this.state.startPoint,
          endPoint,
        ),
      })
    }
  }

  /**
   * Render
   */
  render() {
    const className = 'selection ' + (this.state.mouseDown ? 'dragging' : '')
    return (
      <div
        className={className}
        ref="selectionBox"
        onMouseDown={this._onMouseDown}>
        {this.renderChildren()}
        {this.renderSelectionBox()}
      </div>
    )
  }

  /**
   * Render children
   */
  renderChildren() {
    const _this = this
    let index = 0
    let tmpChild
    return React.Children.map(this.props.children, function(child) {
      const tmpKey = isNull(child.key) ? index++ : child.key
      const isSelected = has(_this.selectedChildren, tmpKey)
      tmpChild = React.cloneElement(child, {
        ref: tmpKey,
        selectionParent: _this,
        isSelected,
      })
      return (
        <div
          className={'select-box ' + (isSelected ? 'selected' : '')}
          onClickCapture={e => {
            if ((e.ctrlKey || e.altKey || e.shiftKey) && _this.props.enabled) {
              e.preventDefault()
              e.stopPropagation()
              _this.selectItem(tmpKey, !has(_this.selectedChildren, tmpKey))
            }
          }}>
          {tmpChild}
        </div>
      )
    })
  }

  /**
   * Render selection box
   */
  renderSelectionBox() {
    if (
      !this.state.mouseDown ||
      isNull(this.state.endPoint) ||
      isNull(this.state.startPoint)
    ) {
      return null
    }
    return <div className="selection-border" style={this.state.selectionBox} />
  }

  /**
   * Manually update the selection status of an item
   * @param {string} key the item's target key value
   * @param {boolean} isSelected the item's target selection status
   */
  selectItem(key, isSelected) {
    if (isSelected) {
      this.selectedChildren[key] = isSelected
    } else {
      delete this.selectedChildren[key]
    }
    this.props.onSelectionChange.call(null, keys(this.selectedChildren))
    this.forceUpdate()
  }

  /**
   * Select all items
   */
  selectAll() {
    each(
      this.refs,
      function(ref, key) {
        if (key !== 'selectionBox') {
          this.selectedChildren[key] = true
        }
      }.bind(this),
    )
  }

  /**
   * Manually clear selected items
   */
  clearSelection() {
    this.selectedChildren = {}
    this.props.onSelectionChange.call(null, [])
    this.forceUpdate()
  }

  /**
   * Detect 2D box intersection
   */
  _boxIntersects(boxA, boxB) {
    if (
      boxA.left <= boxB.left + boxB.width &&
      boxA.left + boxA.width >= boxB.left &&
      boxA.top <= boxB.top + boxB.height &&
      boxA.top + boxA.height >= boxB.top
    ) {
      return true
    }
    return false
  }

  /**
   * Updates the selected items based on the
   * collisions with selectionBox
   */
  _updateCollidingChildren(selectionBox) {
    let tmpNode = null
    let tmpBox = null
    const _this = this
    each(this.refs, function(ref, key) {
      if (key !== 'selectionBox') {
        tmpNode = findDOMNode(ref)
        tmpBox = {
          top: tmpNode.offsetTop,
          left: tmpNode.offsetLeft,
          width: tmpNode.clientWidth,
          height: tmpNode.clientHeight,
        }
        if (_this._boxIntersects(selectionBox, tmpBox)) {
          _this.selectedChildren[key] = true
        } else {
          if (!_this.state.appendMode) {
            delete _this.selectedChildren[key]
          }
        }
      }
    })
  }

  /**
   * Calculate selection box dimensions
   */
  _calculateSelectionBox(startPoint, endPoint) {
    if (!this.state.mouseDown || isNull(endPoint) || isNull(startPoint)) {
      return null
    }
    // const parentNode = this.refs.selectionBox
    const left = Math.min(startPoint.x, endPoint.x)
    const top = Math.min(startPoint.y, endPoint.y)
    const width = Math.abs(startPoint.x - endPoint.x)
    const height = Math.abs(startPoint.y - endPoint.y)
    const box = this.refs.selectionBox
    const boxRect = box.getBoundingClientRect()
    return {
      left: left - boxRect.left,
      top: top - boxRect.top,
      width,
      height,
    }
  }
}

module.exports = Selection
