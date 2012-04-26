/**
 * @module sample_app/app/models/person
 */

require('../core');
require('ember/model');

SampleApp.Person = Ember.Model.extend({
  firstName: Ember.Model.attr('string'),
  lastName:  Ember.Model.attr('string'),

  fullName: function() {
    return this.getEach('firstName', 'lastName').join(' ');
  }.property('firstName', 'lastName')
});

