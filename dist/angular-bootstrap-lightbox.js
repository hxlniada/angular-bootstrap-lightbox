/**
 * @namespace bootstrapLightbox
 */
angular.module('bootstrapLightbox', [
  'swfobject',
  'ui.bootstrap.modal',
  'ui.bootstrap.tpls' // templates
]);
angular.module('bootstrapLightbox').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('lightbox.html',
    "<div class=modal-body ng-swipe-left=Lightbox.nextImage() ng-swipe-right=Lightbox.prevImage()><div class=lightbox-nav><button class=close aria-hidden=true ng-click=$dismiss()>×</button></div><div class=lightbox-image-container><div ng-if=Lightbox.showFlash><swf-object lightbox-flash lightbox-src={{Lightbox.imageUrl}} swf-url={{Lightbox.imageUrl}} swf-width={{Lightbox.width}} swf-height={{Lightbox.height}}></swf-object></div><img ng-if=!Lightbox.showFlash lightbox-src={{Lightbox.imageUrl}} alt=\"\"></div></div>"
  );

}]);
/**
 * @class     ImageLoader
 * @classdesc Service for loading an image.
 * @memberOf  bootstrapLightbox
 */
angular.module('bootstrapLightbox').service('ImageLoader', ['$q',
    function ($q) {
  /**
   * Load the image at the given URL.
   * @param    {String} url
   * @return   {Promise} A $q promise that resolves when the image has loaded
   *   successfully.
   * @type     {Function}
   * @name     load
   * @memberOf bootstrapLightbox.ImageLoader
   */
  this.load = function (url) {
    var deferred = $q.defer();

    var image = new Image();

    // when the image has loaded
    image.onload = function () {
      // check image properties for possible errors
      if ((typeof this.complete === 'boolean' && this.complete === false) ||
          (typeof this.naturalWidth === 'number' && this.naturalWidth === 0)) {
        deferred.reject();
      }

      deferred.resolve(image);
    };

    // when the image fails to load
    image.onerror = function () {
      deferred.reject();
    };

    // start loading the image
    image.src = url;

    return deferred.promise;
  };
}]);
/**
 * @class     Lightbox
 * @classdesc Lightbox service.
 * @memberOf  bootstrapLightbox
 */
angular.module('bootstrapLightbox').provider('Lightbox', function () {
  /**
   * Template URL passed into `$modal.open()`.
   * @type     {String}
   * @name     templateUrl
   * @memberOf bootstrapLightbox.Lightbox
   */
  this.templateUrl = 'lightbox.html';

  /**
   * @param    {*} image An element in the array of images.
   * @return   {Boolean} true if medium is video
   * @type     {Function}
   * @name     isFlash
   * @memberOf bootstrapLightbox.Lightbox
   */
  this.isFlash = function (image) {
    return /\.swf$/.test(image);
  };

  /**
   * Calculate the max and min limits to the width and height of the displayed
   *   image (all are optional). The max dimensions override the min
   *   dimensions if they conflict.
   * @param    {Object} dimensions Contains the properties `windowWidth`,
   *   `windowHeight`, `imageWidth`, and `imageHeight`.
   * @return   {Object} May optionally contain the properties `minWidth`,
   *   `minHeight`, `maxWidth`, and `maxHeight`.
   * @type     {Function}
   * @name     calculateImageDimensionLimits
   * @memberOf bootstrapLightbox.Lightbox
   */
  this.calculateImageDimensionLimits = function (dimensions) {
    if (dimensions.windowWidth >= 768) {
      return {
        // 92px = 2 * (30px margin of .modal-dialog
        //             + 1px border of .modal-content
        //             + 15px padding of .modal-body)
        // with the goal of 30px side margins; however, the actual side margins
        // will be slightly less (at 22.5px) due to the vertical scrollbar
        'maxWidth': dimensions.windowWidth - 92,
        // 126px = 92px as above
        //         + 34px outer height of .lightbox-nav
        'maxHeight': dimensions.windowHeight - 126
      };
    } else {
      return {
        // 52px = 2 * (10px margin of .modal-dialog
        //             + 1px border of .modal-content
        //             + 15px padding of .modal-body)
        'maxWidth': dimensions.windowWidth - 52,
        // 86px = 52px as above
        //        + 34px outer height of .lightbox-nav
        'maxHeight': dimensions.windowHeight - 86
      };
    }
  };

  /**
   * Calculate the width and height of the modal. This method gets called
   *   after the width and height of the image, as displayed inside the modal,
   *   are calculated.
   * @param    {Object} dimensions Contains the properties `windowWidth`,
   *   `windowHeight`, `imageDisplayWidth`, and `imageDisplayHeight`.
   * @return   {Object} Must contain the properties `width` and `height`.
   * @type     {Function}
   * @name     calculateModalDimensions
   * @memberOf bootstrapLightbox.Lightbox
   */
  this.calculateModalDimensions = function (dimensions) {
    // 400px = arbitrary min width
    // 32px = 2 * (1px border of .modal-content
    //             + 15px padding of .modal-body)
    var width = Math.max(400, Number(dimensions.imageDisplayWidth) + 32);

    // 200px = arbitrary min height
    // 66px = 32px as above
    //        + 34px outer height of .lightbox-nav
    var height = Math.max(200, Number(dimensions.imageDisplayHeight) + 66);

    // first case:  the modal width cannot be larger than the window width
    //              20px = arbitrary value larger than the vertical scrollbar
    //                     width in order to avoid having a horizontal scrollbar
    // second case: Bootstrap modals are not centered below 768px
    if (width >= dimensions.windowWidth - 20 || dimensions.windowWidth < 768) {
      width = 'auto';
    }

    // the modal height cannot be larger than the window height
    if (height >= dimensions.windowHeight) {
      height = 'auto';
    }

    return {
      'width': width,
      'height': height
    };
  };

  this.$get = ['$document', '$modal', '$timeout', 'ImageLoader',
      function ($document, $modal, $timeout, ImageLoader) {

    var Lightbox = {};


    // set the configurable properties and methods, the defaults of which are
    // defined above
    Lightbox.templateUrl = this.templateUrl;
    Lightbox.isFlash = this.isFlash;
    Lightbox.calculateImageDimensionLimits = this.calculateImageDimensionLimits;
    Lightbox.calculateModalDimensions = this.calculateModalDimensions;

    /**
     * The imageUrl currently shown in the lightbox.
     * @type     {*}
     * @name     imageUrl
     * @memberOf bootstrapLightbox.Lightbox
     */
    Lightbox.imageUrl = '';

    /**
     * The UI Bootstrap modal instance. See {@link
     *   http://angular-ui.github.io/bootstrap/#/modal}.
     * @type     {Object}
     * @name     modalInstance
     * @memberOf bootstrapLightbox.Lightbox
     */
    Lightbox.modalInstance = null;

    /**
     * The URL of the current image. This is a property of the service rather
     *   than of `Lightbox.image` because `Lightbox.image` need not be an
     *   object, and besides it would be poor practice to alter the given
     *   objects.
     * @type     {String}
     * @name     imageUrl
     * @memberOf bootstrapLightbox.Lightbox
     */

    /**
     * The optional caption of the current image.
     * @type     {String}
     * @name     imageCaption
     * @memberOf bootstrapLightbox.Lightbox
     */

    /**
     * Open the lightbox modal.
     * @param    {Array}  newImages An array of images. Each image may be of
     *   any type.
     * @param    {Number} newIndex  The index in `newImages` to set as the
     *   current image.
     * @return   {Object} The created UI Bootstrap modal instance.
     * @type     {Function}
     * @name     openModal
     * @memberOf bootstrapLightbox.Lightbox
     */
    Lightbox.openModal = function (image, width, height) {
      Lightbox.setImage(image);

      if (width) {
        Lightbox.width = width;
      }
      if (height) {
        Lightbox.height = height;
      }
      // store the modal instance so we can close it manually if we need to
      Lightbox.modalInstance = $modal.open({
        'templateUrl': Lightbox.templateUrl,
        'controller': ['$scope', function ($scope) {
          // $scope is the modal scope, a child of $rootScope
          $scope.Lightbox = Lightbox;

          Lightbox.keyboardNavEnabled = true;
        }],
        'windowClass': 'lightbox-modal'
      });

      // modal close handler
      Lightbox.modalInstance.result['finally'](function () {
        // prevent the lightbox from flickering from the old image when it gets
        // opened again
        Lightbox.imageUrl = null;
        Lightbox.showFlash = null;
      });

      return Lightbox.modalInstance;
    };

    /**
     * Close the lightbox modal.
     * @param    {*} result This argument can be useful if the modal promise
     *   gets handler(s) attached to it.
     * @type     {Function}
     * @name     closeModal
     * @memberOf bootstrapLightbox.Lightbox
     */
    Lightbox.closeModal = function (result) {
      return Lightbox.modalInstance.close(result);
    };

    /**
     * This method can be used in all methods which navigate/change the
     *   current image.
     * @param    {Number} newIndex The index in the array of images to set as
     *   the new current image.
     * @type     {Function}
     * @name     setImage
     * @memberOf bootstrapLightbox.Lightbox
     */
    Lightbox.setImage = function (image) {

      var imageUrl = image;
      Lightbox.showFlash = Lightbox.isFlash(image);
      if (Lightbox.showFlash){
          // set the url and caption
          Lightbox.imageUrl = image;
      } else {
          // load the image before setting it, so everything in the view is updated
          // at the same time; otherwise, the previous image remains while the
          // current image is loading
          ImageLoader.load(imageUrl).then(function () {

            // set the url and caption
            Lightbox.imageUrl = imageUrl;
          }, function () {

            // blank image
            Lightbox.imageUrl = '//:0';
          });
      }
    };

    return Lightbox;
  }];
});
/**
 * @class     lightboxSrc
 * @classdesc This attribute directive is used in an `<img>` element in the
 *   modal template in place of `src`. It handles resizing both the `<img>`
 *   element and its relevant parent elements within the modal.
 * @memberOf  bootstrapLightbox
 */
angular.module('bootstrapLightbox').directive('lightboxSrc', ['$window',
    'ImageLoader', 'Lightbox', function ($window, ImageLoader, Lightbox) {

  // the dimensions of the image
  var imageWidth = 0;
  var imageHeight = 0;

  return {
    'link': function (scope, element, attrs) {
      // resize the img element and the containing modal
      var resize = function () {
        // get the window dimensions
        var windowWidth = $window.innerWidth;
        var windowHeight = $window.innerHeight;

        // calculate the max/min dimensions for the image
        var imageDimensionLimits = Lightbox.calculateImageDimensionLimits({
          'windowWidth': windowWidth,
          'windowHeight': windowHeight,
          'imageWidth': imageWidth,
          'imageHeight': imageHeight
        });

        // calculate the dimensions to display the image
        var imageDisplayDimensions = angular.extend({
            'width': imageWidth,
            'height': imageHeight,
            'minWidth': 1,
            'minHeight': 1,
            'maxWidth': 3000,
            'maxHeight': 3000,
          }, imageDimensionLimits);

        // calculate the dimensions of the modal container
        var modalDimensions = Lightbox.calculateModalDimensions({
          'windowWidth': windowWidth,
          'windowHeight': windowHeight,
          'imageDisplayWidth': imageDisplayDimensions.width,
          'imageDisplayHeight': imageDisplayDimensions.height
        });

        // resize the image
        element.css({
          'width': imageDisplayDimensions.width + 'px',
          'height': imageDisplayDimensions.height + 'px'
        });
        // setting the height on .modal-dialog does not expand the div with the
        // background, which is .modal-content
        angular.element(
          document.querySelector('.lightbox-modal .modal-dialog')
        ).css({
          'width': modalDimensions.width + 'px'
        });

        // .modal-content has no width specified; if we set the width on
        // .modal-content and not on .modal-dialog, .modal-dialog retains its
        // default width of 600px and that places .modal-content off center
        angular.element(
          document.querySelector('.lightbox-modal .modal-content')
        ).css({
          'height': modalDimensions.height + 'px'
        });
      };

      // load the new image and/or resize the video whenever the attr changes
      scope.$watch(function () {
        return attrs.lightboxSrc;
      }, function (src) {

        if (src && angular.isDefined(attrs.lightboxFlash)){
          imageWidth = attrs.swfWidth;
          imageHeight = attrs.swfHeight;
          // resize the video element and the containing modal
          resize();
          return;
        }

        // blank the image before resizing the element; see
        // http://stackoverflow.com/questions/5775469
        element[0].src = '//:0';

        ImageLoader.load(src).then(function (image) {
          // these variables must be set before resize(), as they are used in it
          imageWidth = image.naturalWidth;
          imageHeight = image.naturalHeight;

          // resize the img element and the containing modal
          resize();

          // show the image
          element[0].src = src;
        });
      });

      // resize the image and modal whenever the window gets resized
      angular.element($window).on('resize', resize);
    }
  };
}]);
