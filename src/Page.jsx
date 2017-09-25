import { h, Component } from 'preact';
import mergeClassNames from 'merge-class-names';

import PageCanvas from './PageCanvas';
import PageTextContent from './PageTextContent';

import {
  callIfDefined,
  isProvided,
  makeCancellable,
} from './shared/util';
import { makeEventProps } from './shared/events';

export default class Page extends Component {
  state = {
    page: null,
  }

  componentDidMount() {
    this.loadPage();
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.pdf !== this.props.pdf ||
      this.getPageNumber(nextProps) !== this.getPageNumber()
    ) {
      this.loadPage(nextProps);
    }
  }

  componentWillUnmount() {
    if (this.runningTask && this.runningTask.cancel) {
      this.runningTask.cancel();
    }
  }

  /**
   * Called when a page is loaded successfully
   */
  onLoadSuccess = (page) => {
    this.setState({ page });

    const { pageCallback } = this;

    callIfDefined(
      this.props.onLoadSuccess,
      pageCallback,
    );
  }

  /**
   * Called when a page failed to load
   */
  onLoadError = (error) => {
    if (error === 'cancelled') {
      return;
    }

    callIfDefined(
      this.props.onLoadError,
      error,
    );

    this.setState({ page: false });
  }

  getPageIndex(props = this.props) {
    if (isProvided(props.pageIndex)) {
      return props.pageIndex;
    }

    if (isProvided(props.pageNumber)) {
      return props.pageNumber - 1;
    }

    return null;
  }

  getPageNumber(props = this.props) {
    if (isProvided(props.pageNumber)) {
      return props.pageNumber;
    }

    if (isProvided(props.pageIndex)) {
      return props.pageIndex + 1;
    }

    return null;
  }

  get pageIndex() {
    return this.getPageIndex();
  }

  get pageNumber() {
    return this.getPageNumber();
  }

  get rotate() {
    const { rotate } = this.props;

    if (isProvided(rotate)) {
      return rotate;
    }

    const { page } = this.state;

    return page.rotate;
  }

  get scale() {
    const { scale, width } = this.props;
    const { page } = this.state;
    const { rotate } = this;

    // Be default, we'll render page at 100% * scale width.
    let pageScale = 1;

    // If width is defined, calculate the scale of the page so it could be of desired width.
    if (width) {
      const viewport = page.getViewport(scale, rotate);
      pageScale = width / viewport.width;
    }

    return scale * pageScale;
  }

  get pageCallback() {
    const { page } = this.state;
    const { scale } = this;

    return {
      ...page,
      // Legacy callback params
      get width() { return page.view[2] * scale; },
      get height() { return page.view[3] * scale; },
      scale,
      get originalWidth() { return page.view[2]; },
      get originalHeight() { return page.view[3]; },
    };
  }

  get eventProps() {
    return makeEventProps(this.props, this.pageCallback);
  }

  loadPage(props = this.props) {
    const { pdf } = props;
    const pageNumber = this.getPageNumber(props);

    if (!pdf) {
      throw new Error('Attempted to load a page, but no document was specified.');
    }

    if (this.state.page !== null) {
      this.setState({ page: null });
    }

    this.runningTask = makeCancellable(pdf.getPage(pageNumber));

    return this.runningTask.promise
      .then(this.onLoadSuccess)
      .catch(this.onLoadError);
  }

  render({
    pdf,
    children,
    className,
    onGetTextError,
    onGetTextSuccess,
    onRenderError,
    onRenderSuccess,
    renderTextLayer,
  }, { page }) {
    const { pageIndex } = this;

    if (!pdf || !page) {
      return null;
    }

    if (pageIndex < 0 || pageIndex > pdf.numPages) {
      return null;
    }

    return (
      <div
        className={mergeClassNames('ReactPDF__Page', className)}
        style={{ position: 'relative' }}
        {...this.eventProps}
      >
        <PageCanvas
          onRenderError={onRenderError}
          onRenderSuccess={onRenderSuccess}
          page={page}
          rotate={this.rotate}
          scale={this.scale}
        />
        {
          renderTextLayer &&
            <PageTextContent
              onGetTextError={onGetTextError}
              onGetTextSuccess={onGetTextSuccess}
              page={page}
              rotate={this.rotate}
              scale={this.scale}
            />
        }
        {children}
      </div>
    );
  }
}

Page.defaultProps = {
  renderTextLayer: true,
  scale: 1.0,
};
