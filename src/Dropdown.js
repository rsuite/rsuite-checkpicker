import React, { PropTypes } from 'react';
import classNames from 'classnames';
import _ from 'lodash';
import { on } from 'dom-lib';
import SearchBar from './SearchBar';
import DropdownMenu from './DropdownMenu';
import DropdownToggle from './DropdownToggle';
import reactToString from './utils/reactToString';
import filterNodesOfTree from './utils/filterNodesOfTree';
import decorate from './utils/decorate';
import getDataGroupBy from './utils/getDataGroupBy';
import defaultLocale from './locale';
import { IntlProvider } from './intl';

const propTypes = {
  ..._.omit(DropdownMenu.propTypes, [
    'group',
    'activeItemValues',
    'focusItemValue'
  ]),

  /**
   * group by key in `data`
   */
  groupBy: PropTypes.string,
  dropup: PropTypes.bool,
  onSearch: PropTypes.func,
  disabled: PropTypes.bool,
  inverse: PropTypes.bool,
  value: PropTypes.array,
  defaultValue: PropTypes.array,
  renderPlaceholder: PropTypes.func,
  onChange: PropTypes.func,
  locale: PropTypes.object,
  autoAdjustPosition: PropTypes.bool
};

const defaultProps = {
  ...DropdownMenu.defaultProps,
  locale: defaultLocale,
  autoAdjustPosition: true
};

class Dropdown extends React.Component {
  constructor(props) {
    super(props);
    const { data, value, defaultValue, groupBy, valueKey, labelKey, dropup } = props;
    const nextValue = value || defaultValue || [];
    this.state = {
      dropup,
      value: nextValue,
      // Used to hover the active item  when trigger `onKeydown`
      focusItemValue: nextValue ? nextValue[0] : undefined,
      expand: false,
      searchKeyword: '',
      filteredData: data
    };

    if (groupBy === valueKey || groupBy === labelKey) {
      throw Error('`groupBy` can not be equal to `valueKey` and `labelKey`');
    }
  }

  componentDidMount() {
    this.isMounted = true;
  }

  componentWillReceiveProps(nextProps) {
    const { value, data, dropup } = nextProps;
    if (
      !_.isEqual(value, this.props.value) ||
      !_.isEqual(data, this.props.data) ||
      !_.isEqual(dropup, this.props.dropup)
    ) {
      this.setState({
        dropup,
        value,
        filteredData: data
      });
    }
  }

  componentWillUpdate(nextProps, nextState) {

    if (nextState.expand === this.state.expand) {
      return;
    }

    if (nextState.expand) {
      this.bindEvent();
      this.autoAdjustDropdownPosition();

    } else {
      this.unbindEvent();
    }
  }

  componentWillUnmount() {
    this.unbindEvent();
    this.isMounted = false;
  }

  getFocusableMenuItems = () => {
    const { labelKey } = this.props;
    const { menuItems = {} } = this.menuContainer;
    if (!menuItems) {
      return [];
    }
    const items = Object.values(menuItems).map(item => item.props.getItemData());

    return filterNodesOfTree(items,
      item => this.shouldDisplay(item[labelKey])
    );
  }

  getValue() {
    const { value } = this.props;
    return _.isUndefined(value) ? this.state.value : value;
  }

  bindEvent() {
    this.docClickListener = on(document, 'click', this.handleDocumentClick);
    this.docScrollListener = on(document, 'scroll', this.autoAdjustDropdownPosition);
    this.docResizelListener = on(window, 'resize', this.autoAdjustDropdownPosition);
  }
  unbindEvent() {
    this.docClickListener && this.docClickListener.off();
    this.docScrollListener && this.docClickListener.off();
    this.docResizelListener && this.docClickListener.off();
  }
  /**
   * Close menu when click document
   */
  handleDocumentClick = (event) => {
    if (this.isMounted && !this.container.contains(event.target)) {
      this.setState({ expand: false });
    }
  }

  /**
   * Index of keyword  in `label`
   * @param {node} label
   */
  shouldDisplay(label) {

    const { searchKeyword } = this.state;
    if (!_.trim(searchKeyword)) {
      return true;
    }

    const keyword = searchKeyword.toLocaleLowerCase();

    if (typeof label === 'string') {
      return label.toLocaleLowerCase().indexOf(keyword) >= 0;
    } else if (React.isValidElement(label)) {
      const nodes = reactToString(label);
      return nodes.join('').toLocaleLowerCase().indexOf(keyword) >= 0;
    }
    return false;
  }


  get isMounted() {
    return this.mounted;
  }
  set isMounted(isMounted) {
    this.mounted = isMounted;
  }
  findNode(focus) {
    const items = this.getFocusableMenuItems();
    const { focusItemValue } = this.state;

    for (let i = 0; i < items.length; i += 1) {
      if (_.eq(focusItemValue, items[i].value)) {
        focus(items, i);
        return;
      }
    }

    focus(items, -1);
  }
  focusNextMenuItem() {
    this.findNode((items, index) => {
      const focusItem = items[index + 1];
      if (!_.isUndefined(focusItem)) {
        this.setState({ focusItemValue: focusItem.value });
      }
    });
  }
  focusPrevMenuItem() {
    this.findNode((items, index) => {
      const focusItem = items[index - 1];
      if (!_.isUndefined(focusItem)) {
        this.setState({ focusItemValue: focusItem.value });
      }
    });
  }

  selectFocusMenuItem(event) {
    const { onChange } = this.props;
    const { focusItemValue, value } = this.state;

    if (!value.some(v => _.isEqual(v, focusItemValue))) {
      value.push(focusItemValue);
    } else {
      _.remove(value, itemVal => _.isEqual(itemVal, focusItemValue));
    }


    this.setState({ value }, () => {
      onChange && onChange(value, event);
    });
  }

  handleKeyDown = (event) => {
    const { expand } = this.state;
    if (!expand) {
      return;
    }

    switch (event.keyCode) {
      // down
      case 40:
        this.focusNextMenuItem(event);
        event.preventDefault();
        break;
      // up
      case 38:
        this.focusPrevMenuItem(event);
        event.preventDefault();
        break;
      // enter
      case 13:
        this.selectFocusMenuItem(event);
        event.preventDefault();
        break;
      // esc | tab
      case 27:
      case 9:
        this.closeDropdown(event);
        event.preventDefault();
        break;
      default:
    }
  }

  handleSelect = (val, checked, item, event) => {
    const { onChange, onSelect } = this.props;
    const { value } = this.state;

    if (checked) {
      value.push(val);
    } else {
      _.remove(value, itemVal => _.isEqual(itemVal, val));
    }

    this.setState({
      value,
      focusItemValue: val
    }, () => {
      onSelect && onSelect(value, item, event);
      onChange && onChange(value, event);
    });
  }


  handleSearch = (searchKeyword, event) => {
    const { onSearch } = this.props;
    this.setState({ searchKeyword });
    onSearch && onSearch(searchKeyword, event);
  }

  closeDropdown = () => {
    const value = this.getValue();
    this.setState({
      expand: false,
      focusItemValue: value ? value[0] : undefined
    });
  }

  toggleDropdown = (event) => {
    const { onToggle, disabled } = this.props;
    const expand = !this.state.expand;

    if (disabled) {
      return;
    }

    this.setState({ expand }, () => {
      onToggle && onToggle(expand, event);
    });
  }

  autoAdjustDropdownPosition = () => {
    const { height, dropup } = this.props;

    if (!this.isMounted) {
      return;
    }

    if (!_.isUndefined(dropup)) {
      this.setState({ dropup });
      return;
    }

    const el = this.container;
    if (
      el.getBoundingClientRect().bottom + height > window.innerHeight
      && el.getBoundingClientRect().top - height > 0
    ) {
      this.setState({ dropup: true });
    } else {
      this.setState({ dropup: false });
    }
  }

  renderDropdownMenu() {
    const {
      data,
      labelKey,
      groupBy
    } = this.props;

    const { focusItemValue, dropup } = this.state;
    const classes = classNames('dropdown', {
      'menu-dropup': dropup,
    });

    let filteredData = filterNodesOfTree(data,
      item => this.shouldDisplay(item[labelKey])
    );

    // Create a tree structure data when set `groupBy`
    if (groupBy) {
      filteredData = getDataGroupBy(filteredData, groupBy);
    }

    const menuProps = _.pick(this.props, Object.keys(DropdownMenu.propTypes));
    const dropdownMenu = (
      <DropdownMenu
        {...menuProps}
        ref={(ref) => {
          this.menuContainer = ref;
        }}
        key="dropdownMenu"
        activeItemValues={this.getValue()}
        focusItemValue={focusItemValue}
        data={filteredData}
        group={!_.isUndefined(groupBy)}
        onSelect={this.handleSelect}
      />
    );

    const searchBar = (
      <SearchBar
        key="searchBar"
        onChange={this.handleSearch}
        value={this.state.searchKeyword}
      />
    );

    return (
      <div
        className={classes}
      >
        {dropup ? [dropdownMenu, searchBar] : [searchBar, dropdownMenu]}

      </div>
    );
  }

  render() {
    const {
      data,
      valueKey,
      labelKey,
      className,
      renderPlaceholder,
      disabled,
      inverse,
      locale,
      ...props
    } = this.props;

    const { value, expand, dropup } = this.state;
    const elementProps = _.omit(props, Object.keys(propTypes));

    let placeholder = `${value.length} selected`;

    if (renderPlaceholder) {
      placeholder = renderPlaceholder(
        value,
        data.filter(item => value.some(val => _.eq(item[valueKey], val)))
      );
    }

    const classes = classNames(this.prefix('dropdown'), {
      [this.prefix('dropup')]: dropup,
      disabled,
      inverse,
      expand
    }, className);

    return (
      <IntlProvider locale={locale}>
        <div
          {...elementProps}
          className={classes}
          onKeyDown={this.handleKeyDown}
          tabIndex={-1}
          role="menu"
          ref={(ref) => {
            this.container = ref;
          }}
        >
          <DropdownToggle
            onClick={this.toggleDropdown}
          >
            {placeholder}
          </DropdownToggle>
          {expand && this.renderDropdownMenu()}

        </div>
      </IntlProvider>
    );

  }
}

Dropdown.propTypes = propTypes;
Dropdown.defaultProps = defaultProps;

export default decorate()(Dropdown);