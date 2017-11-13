import React from 'react'
import isNull from 'lodash/isNull'
import each from 'lodash/each'
import noop from 'lodash/noop'
import PropTypes from 'prop-types'
import { findDOMNode } from 'react-dom'

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
    appendMode: false,
    selectedChildren: {},
  }

  /**
   * On root element mouse down
   */
  _onMouseDown = e => {
    if (e.target !== e.currentTarget) {
      return false
    }
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
    this.props.onSelectionChange.call(null, this.state.selectedChildren)
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
      if (this.state.mouseDown && !isNull(this.state.selectionBox)) {
        this._updateCollidingChildren(this.state.selectionBox)
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
        ref={ref => {
          this.selectionBox = ref
        }}
        onMouseDown={this._onMouseDown}
      >
        {this.renderChildren()}
        {this.renderSelectionBox()}
      </div>
    )
  }

  /**
   * Render children
   */
  renderChildren() {
    let index = 0
    // let tmpChild
    return React.Children.map(this.props.children, child => {
      const tmpKey = isNull(child.key) ? index++ : child.key
      const isSelected = !!this.state.selectedChildren[tmpKey]
      return (
        <div className={'select-box ' + (isSelected ? 'selected' : '')}>
          <SelectionItem
            ref={tmpKey}
            selectionParent={this}
            isSelected={isSelected}
          >
            {child}
          </SelectionItem>
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
    this.setState({
      selectedChildren: {
        ...this.state.selectedChildren,
        [key]: isSelected,
      },
    })
    this.props.onSelectionChange.call(null, this.state.selectedChildren)
  }

  /**
   * Select all items
   */
  selectAll = () => {
    const selectedChildren = {}
    each(this.refs, (ref, key) => {
      if (key !== 'selectionBox') {
        selectedChildren[key] = true
      }
    })
    this.setState({
      selectedChildren,
    })
  }

  /**
   * Manually clear selected items
   */
  clearSelection() {
    this.setState({
      selectedChildren: {},
    })
    this.props.onSelectionChange.call(null, [])
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
    each(this.refs, (ref, key) => {
      if (key !== 'selectionBox') {
        tmpNode = findDOMNode(ref)
        tmpBox = {
          top: tmpNode.offsetTop,
          left: tmpNode.offsetLeft,
          width: tmpNode.clientWidth,
          height: tmpNode.clientHeight,
        }

        const selectedChildren = { ...this.state.selectedChildren }
        selectedChildren[key] = this._boxIntersects(selectionBox, tmpBox)
        this.setState({
          selectedChildren,
        })
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
    const box = this.selectionBox
    const boxRect = box.getBoundingClientRect()
    return {
      left: left - boxRect.left,
      top: top - boxRect.top - window.scrollY,
      width,
      height,
    }
  }
}

export class SelectionItem extends React.Component {
  static propTypes = {
    selectionParent: PropTypes.object,
    isSelected: PropTypes.bool,
  }

  render() {
    const { children } = this.props
    return <div>{children}</div>
  }
}

export default Selection
